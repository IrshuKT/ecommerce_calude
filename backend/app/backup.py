import os
import shutil
import tempfile
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.services import backup_service
from app.db.session import get_db
from app.models.models import User
from app.api.v1.endpoints.auth  import get_admin_user  

router = APIRouter()


class BackupInfo(BaseModel):
    filename: str
    size_bytes: int
    created_at: str


@router.post("/backup/run", response_model=BackupInfo)
async def trigger_backup(current_admin: User = Depends(get_admin_user)):
    try:
        filename = backup_service.run_backup()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    info = next(b for b in backup_service.list_backups() if b["filename"] == filename)
    return info


@router.get("/backup/list", response_model=list[BackupInfo])
async def list_backups(current_admin: User = Depends(get_admin_user)):
    return backup_service.list_backups()


@router.get("/backup/{filename}/download")
async def download_backup(filename: str, current_admin: User = Depends(get_admin_user)):
    filepath = backup_service._safe_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(filepath, filename=filename, media_type="application/octet-stream")


@router.delete("/backup/{filename}")
async def delete_backup(filename: str, current_admin: User = Depends(get_admin_user)):
    try:
        backup_service.delete_backup(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Backup not found")
    return {"message": "Backup deleted"}


@router.post("/backup/restore")
async def restore_backup(
    confirm: str = Form(...),
    file: UploadFile = File(...),
    current_admin: User = Depends(get_admin_user),
):
    if confirm != "RESTORE":
        raise HTTPException(status_code=400, detail="Type RESTORE to confirm this destructive action")
    if not file.filename.endswith(".dump"):
        raise HTTPException(status_code=400, detail="Only .dump files (created by this system) can be restored")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".dump") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        backup_service.restore_backup(tmp_path)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.remove(tmp_path)

    return {"message": "Database restored successfully"}