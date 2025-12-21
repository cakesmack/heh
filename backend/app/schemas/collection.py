from typing import Optional
from pydantic import BaseModel

class CollectionBase(BaseModel):
    title: str
    subtitle: Optional[str] = None
    image_url: Optional[str] = None
    target_link: str
    is_active: bool = True
    sort_order: int = 0

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(CollectionBase):
    title: Optional[str] = None
    target_link: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

class Collection(CollectionBase):
    id: int

    class Config:
        from_attributes = True
