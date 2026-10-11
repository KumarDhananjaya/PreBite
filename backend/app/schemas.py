from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    name: str
    email: EmailStr
    home_cuisine: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    home_cuisine: str | None = Field(default=None, max_length=80)


class AnalogyCreate(BaseModel):
    home_dish: str = Field(min_length=1, max_length=100)
    note: str = Field(min_length=5, max_length=500)


class RatingCreate(BaseModel):
    reaction: Literal["loved", "okay", "challenging"]
    note: str | None = Field(default=None, max_length=500)


class StampCreate(BaseModel):
    stamp_key: str = Field(min_length=1, max_length=80)

