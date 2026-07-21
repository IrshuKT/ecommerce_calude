from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal
from datetime import date

from datetime import date as date_type
from sqlalchemy import func as sa_func
from app.db.session import get_db
from app.models.recharge import RechargeEntry, RechargeWalletTopup, RechargeCommission, RechargeOperator
from app.services.journal_service import (
    post_recharge_entry_journal, post_wallet_topup_journal,
    post_recharge_commission_journal, get_account_balance, _WALLET_ACCOUNT,
)
from app.api.v1.endpoints.shared_auth import require_roles, ActingUser

router = APIRouter()


@router.get("/wallet-balance")
async def wallet_balances(
    db: AsyncSession = Depends(get_db),
    _: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    result = {}
    for op, code in _WALLET_ACCOUNT.items():
        bal = await get_account_balance(db, code)
        today_result = await db.execute(
            select(sa_func.coalesce(sa_func.sum(RechargeEntry.amount), 0))
            .where(RechargeEntry.operator == op, RechargeEntry.entry_date == date_type.today())
        )
        today_total = today_result.scalar() or 0
        result[op] = {"balance": float(bal["balance"]), "today_total": float(today_total)}
    return result

class RechargeEntryPayload(BaseModel):
    operator: RechargeOperator
    amount: Decimal
    notes: Optional[str] = None


@router.post("/entries", status_code=201)
async def create_recharge_entry(
    payload: RechargeEntryPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager", "sales")),
):
    if payload.amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")

    wallet_code = _WALLET_ACCOUNT[payload.operator]
    bal = await get_account_balance(db, wallet_code)
    if bal["balance"] < payload.amount:
        raise HTTPException(
            400,
            f"Insufficient {payload.operator} wallet balance: have {bal['balance']:.2f}, need {payload.amount}",
        )

    entry = RechargeEntry(
        operator=payload.operator, amount=payload.amount, notes=payload.notes,
        cashier_id=getattr(current_user, "id", None),
    )
    db.add(entry)
    await db.flush()

    journal = await post_recharge_entry_journal(db, entry, created_by_user_id=None)
    entry.journal_id = journal.id
    await db.commit()
    await db.refresh(entry)

    new_bal = await get_account_balance(db, wallet_code)
    return {
        "id": entry.id, "operator": entry.operator, "amount": float(entry.amount),
        "entry_date": entry.entry_date.isoformat(), "new_wallet_balance": float(new_bal["balance"]),
    }


@router.get("/entries")
async def list_recharge_entries(
    db: AsyncSession = Depends(get_db),
    _: ActingUser = Depends(require_roles("admin", "manager", "sales")),
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
):
    query = select(RechargeEntry).order_by(RechargeEntry.created_at.desc())
    if from_date:
        query = query.where(RechargeEntry.entry_date >= from_date)
    if to_date:
        query = query.where(RechargeEntry.entry_date <= to_date)
    result = await db.execute(query.limit(200))
    entries = result.scalars().all()
    return [
        {"id": e.id, "operator": e.operator, "amount": float(e.amount),
         "entry_date": e.entry_date.isoformat(), "notes": e.notes,
         "created_at": e.created_at.isoformat()}
        for e in entries
    ]


class WalletTopupPayload(BaseModel):
    operator: RechargeOperator
    amount: Decimal
    payment_mode: str
    notes: Optional[str] = None


@router.post("/wallet-topup", status_code=201)
async def topup_wallet(
    payload: WalletTopupPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    if payload.amount <= 0:
        raise HTTPException(400, "Amount must be greater than 0")

    topup = RechargeWalletTopup(
        operator=payload.operator, amount=payload.amount,
        payment_mode=payload.payment_mode, notes=payload.notes,
    )
    db.add(topup)
    await db.flush()

    journal = await post_wallet_topup_journal(db, topup)
    topup.journal_id = journal.id
    await db.commit()
    await db.refresh(topup)

    new_bal = await get_account_balance(db, _WALLET_ACCOUNT[payload.operator])
    return {"id": topup.id, "operator": topup.operator, "amount": float(topup.amount),
            "new_wallet_balance": float(new_bal["balance"])}


class RechargeCommissionPayload(BaseModel):
    operator: RechargeOperator
    amount: Decimal
    period_month: int
    period_year: int
    payment_mode: str
    notes: Optional[str] = None


@router.post("/commission", status_code=201)
async def record_commission(
    payload: RechargeCommissionPayload,
    db: AsyncSession = Depends(get_db),
    current_user: ActingUser = Depends(require_roles("admin", "manager")),
):
    commission = RechargeCommission(
        operator=payload.operator, amount=payload.amount,
        period_month=payload.period_month, period_year=payload.period_year,
        payment_mode=payload.payment_mode, notes=payload.notes,
    )
    db.add(commission)
    await db.flush()

    journal = await post_recharge_commission_journal(db, commission)
    commission.journal_id = journal.id
    await db.commit()
    await db.refresh(commission)

    return {"id": commission.id, "operator": commission.operator, "amount": float(commission.amount)}