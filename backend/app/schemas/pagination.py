from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


# Khung chung cho mọi danh sách phân trang: Page[BookOut], Page[LoanOut]...
# page bắt đầu từ 1; total là tổng toàn bộ, không chỉ trang hiện tại.
class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
