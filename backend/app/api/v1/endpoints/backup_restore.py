from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.api.v1.endpoints.auth import get_current_user, get_admin_user
from app.db.session import get_db
from app.models.models import User, UserRole
from app.core.security import verify_password, get_password_hash, create_access_token, decode_token
from sqlalchemy import text
from pydantic import BaseModel
from app.services import backup_service



router = APIRouter()

class RestoreExistingRequest(BaseModel):
    filename: str
    confirm: str


router.post("/backup/restore-existing")
async def restore_existing_backup(
    payload: RestoreExistingRequest,
    current_admin: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),   # add this explicitly
):
    if payload.confirm != "RESTORE":
        raise HTTPException(status_code=400, detail="Type RESTORE to confirm this destructive action")

    pid_result = await db.execute(text("SELECT pg_backend_pid()"))
    my_pid = pid_result.scalar()

    try:
        filepath = backup_service._safe_path(payload.filename)
        backup_service.restore_backup(filepath, exclude_pid=my_pid)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup not found")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"message": "Database restored successfully"}