"""
User Category Follow model.
Tracks which categories users follow for personalized feeds.
"""
from datetime import datetime
from sqlmodel import Field, SQLModel


class UserCategoryFollow(SQLModel, table=True):
    """
    Tracks user category follows.
    
    Attributes:
        user_id: The user following the category
        category_id: The category being followed
        created_at: When the follow was created
    """
    __tablename__ = "user_category_follows"
    
    user_id: str = Field(foreign_key="users.id", primary_key=True)
    category_id: str = Field(foreign_key="categories.id", primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
