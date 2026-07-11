import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.models import CompanySettings
from app.services import backup_service

logger = logging.getLogger("backup_scheduler")
scheduler = AsyncIOScheduler()


async def _scheduled_backup_check():
    """Runs every minute; fires the actual backup once when clock matches auto_backup_time."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CompanySettings).limit(1))
        settings_row = result.scalar_one_or_none()
        if not settings_row or not settings_row.auto_backup_enabled:
            return

        from datetime import datetime
        now_hhmm = datetime.now().strftime("%H:%M")
        if now_hhmm != settings_row.auto_backup_time:
            return

        try:
            filename = await asyncio.to_thread(backup_service.run_backup)
            logger.info(f"Auto-backup completed: {filename}")
            await asyncio.to_thread(backup_service.prune_old_backups, settings_row.auto_backup_retention_days)
        except Exception as e:
            logger.error(f"Auto-backup failed: {e}")


def start_scheduler():
    scheduler.add_job(_scheduled_backup_check, "interval", minutes=1, id="auto_backup_check")
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown(wait=False)