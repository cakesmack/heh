import json
from typing import Optional
from datetime import date
from pydantic import BaseModel, field_validator

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
    # New structured fields
    slug: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    is_featured: bool = False
    show_on_map: bool = False
    filter_params: Optional[dict] = None

    # Hero Customization & Stats (Optional)
    badge_text: Optional[str] = None
    external_link_url: Optional[str] = None
    external_link_label: Optional[str] = None
    stat_1_label: Optional[str] = None
    stat_1_value: Optional[str] = None
    stat_2_label: Optional[str] = None
    stat_2_value: Optional[str] = None
    stat_3_label: Optional[str] = None
    stat_3_value: Optional[str] = None
    specific_venue_ids: Optional[list] = None
    enable_venue_filter: bool = False
    organizer_profile_ids: Optional[list] = None

    @field_validator('filter_params', mode='before')
    @classmethod
    def parse_filter_params(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(CollectionBase):
    title: Optional[str] = None
    target_link: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    fixed_start_date: Optional[date] = None
    fixed_end_date: Optional[date] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    is_featured: Optional[bool] = None
    show_on_map: Optional[bool] = None
    filter_params: Optional[dict] = None

    # Hero Customization & Stats (Optional)
    badge_text: Optional[str] = None
    external_link_url: Optional[str] = None
    external_link_label: Optional[str] = None
    stat_1_label: Optional[str] = None
    stat_1_value: Optional[str] = None
    stat_2_label: Optional[str] = None
    stat_2_value: Optional[str] = None
    stat_3_label: Optional[str] = None
    stat_3_value: Optional[str] = None
    specific_venue_ids: Optional[list] = None
    enable_venue_filter: Optional[bool] = None
    organizer_profile_ids: Optional[list] = None

class Collection(CollectionBase):
    id: int

    class Config:
        from_attributes = True
