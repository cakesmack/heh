from typing import Optional
from datetime import date
from sqlmodel import Field, SQLModel

class Collection(SQLModel, table=True):
    __tablename__ = "collections"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    subtitle: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None)
    target_link: str
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    # Custom date range fields - when set, these override dynamic date filters
    fixed_start_date: Optional[date] = Field(default=None)
    fixed_end_date: Optional[date] = Field(default=None)
