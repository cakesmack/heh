from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class PlatformSettings(SQLModel, table=True):
    """
    Global platform configuration settings for ticketing and fee calculations.
    """
    __tablename__ = "platform_settings"

    id: str = Field(default="global", primary_key=True)
    base_percentage: float = Field(default=3.5, description="Base platform fee percentage (e.g. 3.5%)")
    base_flat_fee: float = Field(default=0.30, description="Base flat platform fee in GBP (e.g. £0.30)")
    hard_cap_amount: float = Field(default=75.00, description="Maximum platform fees accrued per event in GBP")
    updated_at: datetime = Field(default_factory=datetime.utcnow)
