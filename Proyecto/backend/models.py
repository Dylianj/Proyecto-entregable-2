from typing import List, Optional
from datetime import datetime, timezone
from sqlmodel import Field, Relationship, SQLModel

# --- TABLAS INTERMEDIAS ---
class PostTagLink(SQLModel, table=True):
    post_id: Optional[int] = Field(default=None, foreign_key="post.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)

# NUEVA TABLA: Guarda la relación de quién guardó qué
class SavedPost(SQLModel, table=True):
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", primary_key=True)
    post_id: Optional[int] = Field(default=None, foreign_key="post.id", primary_key=True)

# --- TABLAS PRINCIPALES ---
class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    posts: List["Post"] = Relationship(back_populates="tags", link_model=PostTagLink)

class Like(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    post_id: int = Field(foreign_key="post.id")

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    display_name: str = Field(default="Usuario", max_length=18)
    hashed_password: str
    profile_pic_url: Optional[str] = None
    description: Optional[str] = None
    
    posts: List["Post"] = Relationship(back_populates="user")
    comments: List["Comment"] = Relationship(back_populates="user")
    likes: List["Like"] = Relationship()
    
    # NUEVO: El usuario ahora tiene una lista oficial en BDD de pines guardados
    saved_posts: List["Post"] = Relationship(link_model=SavedPost)

class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: int = Field(foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="comments")
    post_id: int = Field(foreign_key="post.id")
    post: Optional["Post"] = Relationship(back_populates="comments")

class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    description: Optional[str] = None
    image_url: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    user: Optional[User] = Relationship(back_populates="posts")
    
    comments: List[Comment] = Relationship(back_populates="post", cascade_delete=True)
    likes: List["Like"] = Relationship()
    tags: List[Tag] = Relationship(back_populates="posts", link_model=PostTagLink)

# --- MODELOS DE DATOS ---
class UserCreate(SQLModel):
    username: str
    password: str

class UserUpdate(SQLModel):
    display_name: Optional[str] = Field(default=None, max_length=18)
    password: Optional[str] = None
    description: Optional[str] = None

class UserLogin(SQLModel):
    username: str
    password: str