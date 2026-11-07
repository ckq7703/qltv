"""Benchmark index full-text search (idx_books_search) bang 1 lenh, tu don dep.

Chay (tu thu muc goc du an, stack docker dang chay):
    docker compose exec -T backend python scripts/benchmark_fts.py
    docker compose exec -T backend python scripts/benchmark_fts.py --rows 200000

Cac buoc: tao N sach gia (isbn 'BULK-...') -> VACUUM ANALYZE -> do EXPLAIN ANALYZE CO index
-> do KHONG index (DROP INDEX trong transaction roi ROLLBACK, index that khong bi mat)
-> xoa sach gia. Don dep nam trong finally nen van chay khi co loi giua chung.
Trigger audit tam tat luc insert/xoa de khong sinh audit_log rac (trigger search_vector
van chay). Luu y: luc do KHONG index, bang books bi khoa ngan (vai giay) voi nguoi khac.
"""
import argparse
import statistics
import sys
from pathlib import Path

# Chay truc tiep bang `python scripts/...` thi sys.path[0] la thu muc scripts,
# nen them thu muc backend de import duoc package `app`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text  # noqa: E402

from app.db import engine  # noqa: E402

INDEX_NAME = "idx_books_search"
BULK_PREFIX = "BULK-"
COMMON_TERM = "Database"  # khop ~1/6 so dong
RARE_TERM = "Quokka"      # khop dung 1 dong trong moi 2000 dong
WARMUP = 1
RUNS = 3

QUERY = "SELECT id, title FROM books WHERE search_vector @@ plainto_tsquery('simple', :term)"


# Xoa sach gia (tat trigger audit trong cung transaction; loi thi rollback se bat lai).
def cleanup(conn) -> int:
    conn.execute(text("ALTER TABLE books DISABLE TRIGGER trg_audit_books"))
    deleted = conn.execute(
        text("DELETE FROM books WHERE isbn LIKE :p"), {"p": BULK_PREFIX + "%"}
    ).rowcount
    conn.execute(text("ALTER TABLE books ENABLE TRIGGER trg_audit_books"))
    return deleted


def seed(conn, rows: int) -> None:
    conn.execute(text("ALTER TABLE books DISABLE TRIGGER trg_audit_books"))
    conn.execute(
        text(
            """
            INSERT INTO books (title, isbn)
            SELECT (ARRAY['Database','Python','Network','Algorithms','Security','Cloud'])[1 + i % 6]
                   || ' Systems ' || i
                   || CASE WHEN i % 2000 = 0 THEN ' Quokka' ELSE '' END,
                   :prefix || i
            FROM generate_series(1, :n) AS i
            """
        ),
        {"prefix": BULK_PREFIX, "n": rows},
    )
    conn.execute(text("ALTER TABLE books ENABLE TRIGGER trg_audit_books"))


# Duyet de quy cay plan, gom ten cac node (Seq Scan, Bitmap Index Scan...).
def _node_types(plan: dict) -> list[str]:
    types = [plan["Node Type"]]
    for child in plan.get("Plans", []):
        types += _node_types(child)
    return types


# Chay EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) 1 lan, tra ve (thoi gian ms, plan, buffers).
def _explain_once(conn, term: str):
    row = conn.execute(
        text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + QUERY), {"term": term}
    ).scalar()
    doc = row[0] if isinstance(row, list) else row
    plan = doc["Plan"]
    buffers = plan.get("Shared Hit Blocks", 0) + plan.get("Shared Read Blocks", 0)
    return doc["Execution Time"], _node_types(plan), buffers, plan.get("Actual Rows", 0)


# Khoi dong 1 lan (lam nong cache) roi do RUNS lan, lay trung vi.
def measure(conn, term: str) -> dict:
    for _ in range(WARMUP):
        _explain_once(conn, term)
    samples = [_explain_once(conn, term) for _ in range(RUNS)]
    times = [s[0] for s in samples]
    _, nodes, buffers, rows_matched = samples[-1]
    return {
        "ms": statistics.median(times),
        "plan": " > ".join(dict.fromkeys(nodes)),
        "buffers": buffers,
        "matched": rows_matched,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=20000, help="so sach gia (mac dinh 20000)")
    args = parser.parse_args()

    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM pg_indexes WHERE indexname = :n"), {"n": INDEX_NAME}
        ).scalar()
    if not exists:
        print(f"Khong thay index {INDEX_NAME}. Chay `alembic upgrade head` truoc.")
        return 1

    results: dict[str, dict[str, dict]] = {}
    try:
        # Don du lieu sot lai tu lan chay truoc (neu co) roi tao moi.
        with engine.begin() as conn:
            leftover = cleanup(conn)
            if leftover:
                print(f"[0/4] Da don {leftover} dong BULK sot lai tu lan truoc")
            print(f"[1/4] Tao {args.rows} sach gia ...")
            seed(conn, args.rows)
        with engine.connect() as conn:
            conn.execution_options(isolation_level="AUTOCOMMIT")
            # VACUUM gop "pending list" cua GIN vao index (insert hang loat de lai danh sach
            # cho chua gop, khien planner tinh chi phi quet index dat va chon Seq Scan);
            # ANALYZE cap nhat thong ke de planner uoc luong dung.
            conn.execute(text("VACUUM ANALYZE books"))
            total = conn.execute(text("SELECT count(*) FROM books")).scalar()
        print(f"      Tong so sach trong bang: {total}")

        print("[2/4] Do CO index ...")
        with engine.connect() as conn:
            for label, term in (("common", COMMON_TERM), ("rare", RARE_TERM)):
                results.setdefault(label, {})["with"] = measure(conn, term)

        print("[3/4] Do KHONG index (DROP INDEX trong transaction, se ROLLBACK) ...")
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                conn.execute(text(f"DROP INDEX {INDEX_NAME}"))
                for label, term in (("common", COMMON_TERM), ("rare", RARE_TERM)):
                    results[label]["without"] = measure(conn, term)
            finally:
                trans.rollback()  # khoi phuc index
    finally:
        print("[4/4] Don dep ...")
        with engine.begin() as conn:
            deleted = cleanup(conn)
        with engine.connect() as conn:
            still = conn.execute(
                text("SELECT 1 FROM pg_indexes WHERE indexname = :n"), {"n": INDEX_NAME}
            ).scalar()
            left = conn.execute(
                text("SELECT count(*) FROM books WHERE isbn LIKE :p"), {"p": BULK_PREFIX + "%"}
            ).scalar()
        print(f"      Da xoa {deleted} sach gia, con lai {left}; index {INDEX_NAME}: "
              f"{'con nguyen' if still else 'BI MAT (can kiem tra!)'}")

    print()
    print(f"KET QUA ({args.rows} dong, trung vi cua {RUNS} lan do)")
    print("| Truy van | Khop | Index | Plan | Thoi gian (ms) | Buffers |")
    print("|---|---|---|---|---|---|")
    for label, term in (("common", COMMON_TERM), ("rare", RARE_TERM)):
        for key, name in (("with", "CO"), ("without", "KHONG")):
            r = results[label][key]
            print(f"| '{term}' | {r['matched']} | {name} | {r['plan']} | {r['ms']:.3f} | {r['buffers']} |")
        speedup = results[label]["without"]["ms"] / results[label]["with"]["ms"]
        print(f"|  |  | **nhanh hon** | | **{speedup:.1f}x** | |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
