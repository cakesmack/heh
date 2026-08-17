from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# -----------------
# Ticket Tier Schemas
# -----------------
class TicketTierBase(BaseModel):
    name: str = Field(..., max_length=100)
    price: float = Field(0.0, ge=0.0)
    quantity_available: int = Field(..., ge=0)
    max_per_order: int = Field(6, ge=1)
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    is_hidden: bool = False

class TicketTierCreate(TicketTierBase):
    id: Optional[str] = None

class TicketTierUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    price: Optional[float] = Field(None, ge=0.0)
    quantity_available: Optional[int] = Field(None, ge=0)
    max_per_order: Optional[int] = Field(None, ge=1)
    sale_start: Optional[datetime] = None
    sale_end: Optional[datetime] = None
    is_hidden: Optional[bool] = None

class TicketTierResponse(TicketTierBase):
    id: str
    event_id: str
    quantity_sold: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Promo Code Schemas
# -----------------
class PromoCodeBase(BaseModel):
    code_text: str = Field(..., max_length=50)
    discount_type: str = Field(...) # 'percentage' or 'fixed_amount'
    discount_value: float = Field(..., ge=0.0)
    usage_limit: Optional[int] = Field(None, ge=1)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    target_tier_id: Optional[str] = None

class PromoCodeCreate(PromoCodeBase):
    pass

class PromoCodeResponse(PromoCodeBase):
    id: str
    event_id: str
    usage_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PromoCodeValidate(BaseModel):
    code: str

# -----------------
# Order Schemas
# -----------------
class OrderBase(BaseModel):
    buyer_name: str = Field(..., max_length=255)
    buyer_email: EmailStr
    buyer_phone: Optional[str] = Field(None, max_length=50)
    attendee_responses: Optional[Dict[str, Any]] = None

class OrderCreate(OrderBase):
    event_id: str
    tickets: Dict[str, int]  # tier_id -> quantity
    promo_code: Optional[str] = None

class OrderResponse(OrderBase):
    id: str
    order_ref: str
    event_id: str
    buyer_user_id: Optional[str]
    total_amount: float
    platform_fee_amount: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# -----------------
# Ticket Schemas
# -----------------
class TicketResponse(BaseModel):
    id: str
    order_id: str
    tier_id: str
    qr_token: str
    status: str
    checked_in_at: Optional[datetime] = None
    checked_in_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OrderDetailResponse(OrderResponse):
    tickets: List[TicketResponse]

class TicketValidationRequest(BaseModel):
    qr_token: str

class TicketValidationResponse(BaseModel):
    valid: bool
    ticket: Optional[TicketResponse] = None
    message: str

# -----------------
# Seller & Organizer Schemas
# -----------------
class SellerAccessRequest(BaseModel):
    reason: Optional[str] = None

class SellerApprovalUpdate(BaseModel):
    seller_tier: int = Field(1, ge=1, le=2)
    seller_status: str = Field(..., pattern="^(none|requested|approved|rejected)$")
