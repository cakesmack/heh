from typing import Optional
from datetime import date
from pydantic import BaseModel

class CollectionBase(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    target_link: str
    is_active: bool = True
    sort_order: int = 0
    # Custom date range fields - override dynamic date filters
    fixed_start_date: Optional[date] = None
    fixed_end_date: Optional[date] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(CollectionBase):
    title: Optional[str] = None
    target_link: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    fixed_start_date: Optional[date] = None
    fixed_end_date: Optional[date] = None

class Collection(CollectionBase):
    id: int

    class Config:
        from_attributes = True
