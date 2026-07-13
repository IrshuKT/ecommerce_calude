import asyncio
import getpass
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.models import InternalUser, InternalRole
from app.core.security import get_password_hash

async def main():
    name = input("Name: ")
    email = input("Email: ")
    phone = input("Phone: ")
    password = getpass.getpass("Password: ")
    print(f"[debug] password length: {len(password)} chars")
    print(f"[debug] password value: {password}")

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(InternalUser).where(InternalUser.email == email))
        if existing.scalar_one_or_none():
            print("User already exists")
            return
        user = InternalUser(
            name=name,
            email=email,
            phone=phone,
            hashed_password=get_password_hash(password),
            role=InternalRole.admin,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        print("Admin created successfully")

if __name__ == "__main__":
    asyncio.run(main())