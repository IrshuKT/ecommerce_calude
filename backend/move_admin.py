import asyncio
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import Order

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Order).where(Order.user_id == 3))
        orders = result.scalars().all()
        for o in orders:
            print(o.id, o.order_number, o.status, o.total_amount, o.created_at)

asyncio.run(main())