import os
import subprocess
import glob
from datetime import datetime
from urllib.parse import urlparse
from pathlib import Path

SYNC_DATABASE_URL = os.getenv("SYNC_DATABASE_URL", "postgresql://glassdoor:glassdoor@localhost/glassdoor")
BACKUP_DIR = os.getenv("BACKUP_DIR", "backups")

_parsed = urlparse(SYNC_DATABASE_URL)
DB_USER = _parsed.username
DB_PASSWORD = _parsed.password
DB_HOST = _parsed.hostname or "localhost"
DB_PORT = str(_parsed.port or 5432)
DB_NAME = _parsed.path.lstrip("/")

Path(BACKUP_DIR).mkdir(parents=True, exist_ok=True)


def _pg_env():
    env = os.environ.copy()
    env["PGPASSWORD"] = DB_PASSWORD or ""
    return env


def _safe_path(filename: str) -> str:
    """Prevent path traversal — only allow bare filenames within BACKUP_DIR."""
    if "/" in filename or "\\" in filename or ".." in filename:
        raise ValueError("Invalid filename")
    return os.path.join(BACKUP_DIR, filename)


def run_backup() -> str:
    """Runs pg_dump in custom format. Returns the filename created."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{DB_NAME}_backup_{ts}.dump"
    filepath = os.path.join(BACKUP_DIR, filename)

    cmd = [
        "pg_dump",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-Fc",  # custom format — required for pg_restore --clean
        "-f", filepath,
        DB_NAME,
    ]
    result = subprocess.run(cmd, env=_pg_env(), capture_output=True, text=True)
    if result.returncode != 0:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise RuntimeError(f"pg_dump failed: {result.stderr.strip()}")
    return filename


def list_backups() -> list[dict]:
    files = glob.glob(os.path.join(BACKUP_DIR, "*.dump"))
    out = []
    for f in sorted(files, key=os.path.getmtime, reverse=True):
        stat = os.stat(f)
        out.append({
            "filename": os.path.basename(f),
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return out


def delete_backup(filename: str):
    filepath = _safe_path(filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError("Backup not found")
    os.remove(filepath)


def prune_old_backups(retention_days: int):
    cutoff = datetime.now().timestamp() - retention_days * 86400
    for f in glob.glob(os.path.join(BACKUP_DIR, "*.dump")):
        if os.path.getmtime(f) < cutoff:
            os.remove(f)


def _terminate_other_connections(exclude_pid: int | None = None):
    """Kill all other active connections to the DB so pg_restore can drop/recreate cleanly.
    exclude_pid lets the caller spare its own current DB session (e.g. the admin auth check)."""
    exclude_clause = f"AND pid <> {exclude_pid}" if exclude_pid else ""
    cmd = [
        "psql", "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", DB_NAME,
        "-c",
        f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        f"WHERE datname = '{DB_NAME}' AND pid <> pg_backend_pid() {exclude_clause};",
    ]
    subprocess.run(cmd, env=_pg_env(), capture_output=True, text=True)


def restore_backup(filepath: str, exclude_pid: int | None = None):
    _terminate_other_connections(exclude_pid)
    cmd = [
        "pg_restore",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", DB_NAME,
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        filepath,
    ]
    result = subprocess.run(cmd, env=_pg_env(), capture_output=True, text=True, timeout=60)
    if result.returncode != 0 and "error" in result.stderr.lower():
        raise RuntimeError(f"pg_restore failed: {result.stderr.strip()}")


def restore_backup_by_filename(filename: str, exclude_pid: int | None = None):
    filepath = _safe_path(filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError("Backup not found")
    restore_backup(filepath, exclude_pid=exclude_pid)