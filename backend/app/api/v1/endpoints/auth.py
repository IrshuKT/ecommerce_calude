from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.db.session import get_db
from app.models.models import User, UserRole
from app.core.security import verify_password, get_password_hash, create_access_token, decode_token
from app.models.models import InternalUser, InternalRole
from app.core.security import verify_password, get_password_hash, create_access_token, decode_token


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    role: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    role: str
    is_verified: bool
    class Config:
        from_attributes = True


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    result = await db.execute(select(User).where(User.id == int(payload.get("sub"))))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def get_optional_current_user(
    token: Optional[str] = Depends(oauth2_scheme_optional),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Like get_current_user, but returns None instead of raising when there's
    no token, an invalid token, or the token belongs to a staff (internal) user.
    Use on endpoints that need to allow EITHER staff OR customer access.
    """
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type") == "internal":
        return None
    result = await db.execute(select(User).where(User.id == int(payload.get("sub"))))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return None
    return user


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if (await db.execute(select(User).where(User.phone == payload.phone))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")
    user = User(name=payload.name, email=payload.email, phone=payload.phone,
                hashed_password=get_password_hash(payload.password), role=UserRole.customer)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=user.id, name=user.name, role=user.role)


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where((User.email == form.username) | (User.phone == form.username)))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=user.id, name=user.name, role=user.role)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


# ── One-time admin setup ──────────────────────────────────────────────────────

class SetupAdminRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    setup_key: str   # must match ADMIN_SETUP_KEY in .env


@router.post("/setup-admin", response_model=TokenResponse, status_code=201)
async def setup_admin(payload: SetupAdminRequest, db: AsyncSession = Depends(get_db)):
    """
    One-time endpoint to create the first admin account.
    Blocked once any admin already exists in the database.
    Requires ADMIN_SETUP_KEY from environment to prevent unauthorized use.
    """
    from app.core.config import settings

    # Validate the setup key
    if payload.setup_key != settings.ADMIN_SETUP_KEY:
        raise HTTPException(status_code=403, detail="Invalid setup key")

    # Block if an admin already exists
    existing = await db.execute(
        select(User).where(User.role == UserRole.admin)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Admin already exists. Use /auth/login to sign in."
        )

    # Check email/phone uniqueness
    if (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    if (await db.execute(select(User).where(User.phone == payload.phone))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        hashed_password=get_password_hash(payload.password),
        role=UserRole.admin,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_id=user.id, name=user.name, role=user.role)


# ── Promote existing user to admin (requires existing admin auth) ─────────────

@router.post("/promote/{user_id}", status_code=200)
async def promote_to_admin(
    user_id: int,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Promote an existing customer to admin. Only callable by an existing admin."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.role = UserRole.admin
    return {"message": f"{target.name} promoted to admin"}

class StaffTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    staff_id: int
    name: str
    role: str


@router.post("/staff-login", response_model=StaffTokenResponse)
async def staff_login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(InternalUser).where(
            (InternalUser.email == form.username) | (InternalUser.phone == form.username)
        )
    )
    staff = result.scalar_one_or_none()
    if not staff or not staff.is_active or not verify_password(form.password, staff.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": str(staff.id), "type": "internal"})
    return StaffTokenResponse(
        access_token=token,
        staff_id=staff.id,
        name=staff.name,
        role=staff.role.value,
    )

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    payload = decode_token(token)
    print(f"[DEBUG] payload: {payload}")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    result = await db.execute(select(User).where(User.id == int(payload.get("sub"))))
    user = result.scalar_one_or_none()
    print(f"[DEBUG] user found: {user}")
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user