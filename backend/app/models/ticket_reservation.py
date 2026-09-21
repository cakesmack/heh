from datetime import datetime
from typing import Optional, TYPE_CHECKING
from uuid import uuid4

from sqlalchemy import CheckConstraint, Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from .order import Order
    from .ticket_tier import TicketTier


class TicketReservation(SQLModel, table=True):
    """Durable per-tier inventory commitment owned by one checkout order."""

    __tablename__ = "ticket_reservations"
    __table_args__ = (
        UniqueConstraint("order_id", "tier_id", name="uq_ticket_reservations_order_tier"),
        CheckConstraint("quantity > 0", name="ck_ticket_reservations_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_ticket_reservations_unit_price_nonnegative"),
        CheckConstraint(
            "status IN ('active', 'consumed', 'released')",
            name="ck_ticket_reservations_status",
        ),
    )

    id: str = Field(default_factory=lambda: str(uuid4()).replace("-", ""), primary_key=True)
    order_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("orders.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    tier_id: str = Field(
        sa_column=Column(String, ForeignKey("ticket_tiers.id"), index=True, nullable=False)
    )
    quantity: int = Field(nullable=False, gt=0)
    unit_price: float = Field(nullable=False, ge=0.0)
    status: str = Field(default="active", max_length=16, index=True)
    consumed_at: Optional[datetime] = Field(default=None)
    released_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    order: "Order" = Relationship(back_populates="reservations")
    tier: "TicketTier" = Relationship(back_populates="reservations")
