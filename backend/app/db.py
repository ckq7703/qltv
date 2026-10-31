# Kết nối PostgreSQL và quản lý session SQLAlchemy
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# pool_pre_ping: kiểm tra kết nối còn sống trước khi dùng, tránh lỗi khi DB restart.
# autoflush/autocommit tắt: code tự commit, mọi thao tác nằm trong transaction.
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


# Lớp cha của mọi model ORM.
class Base(DeclarativeBase):
    pass


# Dependency FastAPI: mỗi request nhận 1 session riêng, đóng lại khi xong.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
