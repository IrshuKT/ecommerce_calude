# run_once_add_round_off_account.py
import asyncio
from app.db.session import get_db  # or however you get an AsyncSession outside FastAPI
from app.models.accounting import Account, AccountType
from sqlalchemy import select

async def add_round_off_account():
    async for db in get_db():
        existing = await db.execute(select(Account).where(Account.code == "4900"))
        if existing.scalar_one_or_none():
            print("Already exists")
            return
        db.add(Account(code="4900", name="Round Off", account_type=AccountType.income, is_system=False, is_active=True))
        await db.commit()
        print("✓ Added account 4900 - Round Off")
        break

asyncio.run(add_round_off_account())