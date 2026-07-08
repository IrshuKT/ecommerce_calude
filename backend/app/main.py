from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1 import router as api_router
import os

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION,
              docs_url="/api/docs", redoc_url="/api/redoc")

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Seed chart of accounts on first run."""
    from app.db.session import AsyncSessionLocal
    from app.services.account_seeder import seed_accounts
    async with AsyncSessionLocal() as db:
        try:
            await seed_accounts(db)
            await db.commit()
        except Exception as e:
            print(f"Account seeding skipped: {e}")


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
