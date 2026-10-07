from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, Annotated

class Post(BaseModel):
    title: str
    content: str
    published: bool = True

class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str
    about: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    id: int
    username: str
    about: str
    created_at: datetime

    class Config:
        from_attributes = True


class FollowOut(BaseModel):
    follower_username: str
    followed_username: str
    created_at: datetime

    class Config:
        from_attributes = True

class PostResponse(BaseModel):
    id: int
    title: str
    content: str
    published: bool
    created_at: datetime
    owner_id: int
    owner: UserPublic

    class Config:
        from_attributes = True    


class PostOut(BaseModel):
    Post: PostResponse
    likes: int

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_]+$",
    )
    about: Optional[str] = Field(default=None, max_length=280)


class UserLogin(BaseModel):
     email: EmailStr
     password: str

class Token(BaseModel):
     access_token: str
     token_type: str

class TokenData(BaseModel):
     id: Optional[int] = None    

class Vote(BaseModel):
     post_id: int
     dir: Annotated[int, Field(ge=0, le=1)]


class ReplyCreate(BaseModel):
    content: str = Field(min_length=1, max_length=280)


class ReplyOut(BaseModel):
    id: int
    content: str
    created_at: datetime
    post_id: int
    owner_id: int
    owner: UserPublic

    class Config:
        from_attributes = True
