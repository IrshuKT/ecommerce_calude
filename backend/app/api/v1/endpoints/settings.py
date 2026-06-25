from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import uuid

from app.db.session import get_db
from app.models.models import CompanySettings, User
from app.api.v1.endpoints.auth import get_admin_user, get_current_user

router = APIRouter()


async def get_or_create_settings(db: AsyncSession) -> CompanySettings:
    result = await db.execute(select(CompanySettings).limit(1))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = CompanySettings()
        db.add(settings)
        await db.flush()
    return settings


@router.get("/")
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Public endpoint — returns company info for frontend."""
    settings = await get_or_create_settings(db)
    return {
        "company_name": settings.company_name,
        "tagline": settings.tagline,
        "logo_url": settings.logo_url,
        "email": settings.email,
        "phone": settings.phone,
        "mobile": settings.mobile,
        "address_line1": settings.address_line1,
        "address_line2": settings.address_line2,
        "city": settings.city,
        "state": settings.state,
        "state_code": settings.state_code,
        "pincode": settings.pincode,
        "country": settings.country,
        "gstin": settings.gstin,
        "website": settings.website,
        "invoice_terms": settings.invoice_terms,
        "invoice_footer": settings.invoice_footer,
        "bank_name": settings.bank_name,
        "bank_account_number": settings.bank_account_number,
        "bank_ifsc": settings.bank_ifsc,
        "bank_branch": settings.bank_branch,
    }


@router.patch("/")
async def update_settings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    settings = await get_or_create_settings(db)
    allowed = {
        "company_name", "tagline", "email", "phone", "mobile",
        "address_line1", "address_line2", "city", "state", "state_code",
        "pincode", "country", "gstin", "pan", "bank_name",
        "bank_account_number", "bank_ifsc", "bank_branch",
        "invoice_prefix", "invoice_terms", "invoice_footer", "website",
    }
    for k, v in payload.items():
        if k in allowed:
            setattr(settings, k, v)
    return {"message": "Settings updated"}


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    from app.core.config import settings as app_settings
    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".svg"}:
        raise HTTPException(400, "Invalid file type")
    contents = await file.read()
    upload_dir = Path(app_settings.UPLOAD_DIR) / "company"
    upload_dir.mkdir(parents=True, exist_ok=True)
    filename = f"logo{ext}"
    with open(upload_dir / filename, "wb") as f:
        f.write(contents)
    url = f"/uploads/company/{filename}"
    settings = await get_or_create_settings(db)
    settings.logo_url = url
    return {"logo_url": url}
