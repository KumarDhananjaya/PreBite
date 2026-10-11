from typing import Any, Literal

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


class ExtractedDishSchema(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0.0)
    currency: str | None = Field(default=None, max_length=10)
    category: str | None = Field(default=None, max_length=100)
    ingredients: list[str] = Field(default_factory=list)
    dietary_labels: list[str] = Field(default_factory=list)
    allergens: list[str] = Field(default_factory=list)
    source_text: str | None = Field(default=None, max_length=2000)
    source_page: str | None = Field(default=None, max_length=200)
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class DishUpdateSchema(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    price: float | None = Field(default=None, ge=0.0)
    currency: str | None = Field(default=None, max_length=10)
    category: str | None = Field(default=None, max_length=100)
    ingredients: list[str] | None = None
    dietary_labels: list[str] | None = None
    allergens: list[str] | None = None


class InferredIngredient(BaseModel):
    name: str
    verified: bool = False
    note: str | None = None


class DishAlternative(BaseModel):
    dish_id: str
    name: str
    price: float | None = None
    currency: str | None = None
    category: str | None = None
    dietary_labels: list[str] = Field(default_factory=list)
    similarity_reason: str


class DishImageSchema(BaseModel):
    url: str
    source_url: str
    title: str = ""
    artist: str = ""
    license: str = ""


class DishExplanationSchema(BaseModel):
    images: list[DishImageSchema] = Field(default_factory=list)
    dish_id: str
    dish_name: str
    menu_category: str | None = None
    menu_price: float | None = None
    menu_currency: str | None = None
    source_description: str | None = None
    source_menu: str | None = None
    source_page: str | None = None

    # Understand this dish
    general_explanation: str
    culinary_terms: dict[str, str] = Field(default_factory=dict)
    flavor_profile: str | None = None
    spice_level: str | None = None

    # Distinction between restaurant statement and AI inference
    restaurant_facts: dict[str, Any] = Field(default_factory=dict)
    ai_inferences: dict[str, Any] = Field(default_factory=dict)

    # Ingredients & dietary information
    explicit_ingredients: list[str] = Field(default_factory=list)
    inferred_ingredients: list[InferredIngredient] = Field(default_factory=list)
    dietary_labels: list[str] = Field(default_factory=list)
    explicit_allergens: list[str] = Field(default_factory=list)
    allergy_warning: str = Field(
        default="Menu text alone cannot establish that a dish is safe for someone with an allergy. Always verify severe allergies and preparation risks directly with restaurant staff."
    )

    # Explore alternatives from same menu
    alternatives: list[DishAlternative] = Field(default_factory=list)

    # Missing / uncertain indicators
    uncertain_fields: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.85, ge=0.0, le=1.0)
    cached: bool = False


class ScanMatchItem(BaseModel):
    id: str
    name: str
    category: str | None = None
    price: float | None = None
    currency: str | None = None
    description: str | None = None
    dietary_labels: list[str] = Field(default_factory=list)
    allergens: list[str] = Field(default_factory=list)
    scan_confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    match_reason: str | None = None
    matched_text: str | None = None
