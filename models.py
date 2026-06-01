from typing import List, Optional
from datetime import datetime, timezone
from sqlmodel import Field, Relationship, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    profile_pic_url: Optional[str] = None
    description: Optional[str] = None
    
    posts: List["Post"] = Relationship(back_populates="user")
    comments: List["Comment"] = Relationship(back_populates="user")

class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    image_url: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="posts")
    
    comments: List["Comment"] = Relationship(back_populates="post", cascade_delete=True)

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="comments")
    
    post_id: Optional[int] = Field(default=None, foreign_key="post.id")
    post: Optional[Post] = Relationship(back_populates="comments")


class UserCreate(SQLModel):
    username: str
    password: str

class UserUpdate(SQLModel):
    username: Optional[str] = None
    password: Optional[str] = None
    description: Optional[str] = None

class UserLogin(SQLModel):
    username: str
    password: str