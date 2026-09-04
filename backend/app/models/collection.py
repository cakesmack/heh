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
    show_on_map: bool = Field(default=False)
    filter_params: Optional[dict] = Field(default=None, sa_column=Column(JSONB))

    # Hero Customization & Stats (Optional)
    badge_text: Optional[str] = Field(default=None, max_length=100)
    external_link_url: Optional[str] = Field(default=None, max_length=500)
    external_link_label: Optional[str] = Field(default=None, max_length=100)
    stat_1_label: Optional[str] = Field(default=None, max_length=100)
    stat_1_value: Optional[str] = Field(default=None, max_length=100)
    stat_2_label: Optional[str] = Field(default=None, max_length=100)
    stat_2_value: Optional[str] = Field(default=None, max_length=100)
    stat_3_label: Optional[str] = Field(default=None, max_length=100)
    stat_3_value: Optional[str] = Field(default=None, max_length=100)
    specific_venue_ids: Optional[list] = Field(default=None, sa_column=Column(JSONB))
    enable_venue_filter: bool = Field(default=False)
    organizer_profile_ids: Optional[list] = Field(default=None, sa_column=Column(JSONB))

    @property
    def match_mode(self) -> str:
        if self.filter_params and isinstance(self.filter_params, dict):
            return (self.filter_params.get("combine_operator") or self.filter_params.get("match_mode") or "and").upper()
        return "AND"
