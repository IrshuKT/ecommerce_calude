from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            try:
                await session.rollback()
            except Exception:
                pass
            if "ConnectionDoesNotExistError" in str(type(e)) or "connection was closed" in str(e):
                return  # swallow — likely our own intentional termination during restore
            raise
        finally:
            try:
                await session.close()
            except Exception:
                pass