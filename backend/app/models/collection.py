from typing import Optional
from datetime import date
from sqlmodel import Field, SQLModel, Column
from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB

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
    # New fields for structured collections
    slug: Optional[str] = Field(default=None, sa_column_kwargs={"unique": True})
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    long_description: Optional[str] = Field(default=None, sa_column=Column(Text))
    seo_title: Optional[str] = Field(default=None, max_length=255)
    seo_description: Optional[str] = Field(default=None, max_length=500)
    is_featured: bool = Field(default=False)
    filter_params: Optional[dict] = Field(default=None, sa_column=Column(JSONB))
