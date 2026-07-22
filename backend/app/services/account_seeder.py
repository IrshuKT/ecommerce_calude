from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.accounting import Account, AccountType

ACCOUNTS = [
    ("1000","Current Assets",AccountType.asset,None,True),
    ("1010","Cash in Hand",AccountType.asset,"1000",True),
    ("1020","Bank Account",AccountType.asset,"1000",True),
    ("1030","Petty Cash",AccountType.asset,"1000",False),
    ("1100","Inventory / Stock",AccountType.asset,"1000",True),
    ("1110","Glass Stock",AccountType.asset,"1100",True),
    ("1200","Accounts Receivable",AccountType.asset,"1000",True),
    ("1300","Input IGST",AccountType.asset,"1000",True),
    ("1310","Input CGST",AccountType.asset,"1000",True),
    ("1320","Input SGST",AccountType.asset,"1000",True),
    ("1400","Advance to Vendors",AccountType.asset,"1000",False),
    ("1401", "Recharge Wallet - Jio" ,AccountType.asset, "1000",False),
    ("1402", "Recharge Wallet - Airtel",AccountType.asset,"1000",False),
    ("1403", "Recharge Wallet - Vi",AccountType.asset,"1000",False),
    ("1404", "Recharge Wallet - BSNL",AccountType.asset,"1000",False),
    ("1500","Fixed Assets",AccountType.asset,None,True),
    ("1510","Machinery",AccountType.asset,"1500",False),
    ("1520","Furniture & Fixtures",AccountType.asset,"1500",False),
    ("1530","Computer & Equipment",AccountType.asset,"1500",False),
    ("2000","Accounts Payable",AccountType.liability,None,True),
    ("2100","CGST Payable",AccountType.liability,None,True),
    ("2200","SGST Payable",AccountType.liability,None,True),
    ("2300","IGST Payable",AccountType.liability,None,True),
    ("2400","TDS Payable",AccountType.liability,None,False),
    ("2500","Advance from Customers",AccountType.liability,None,False),
    ("2600","Loans & Borrowings",AccountType.liability,None,False),
    ("3000","Owner's Capital",AccountType.equity,None,True),
    ("3100","Retained Earnings",AccountType.equity,None,True),
    ("3200","Drawings",AccountType.equity,None,False),
    ("4000","Sales Revenue",AccountType.income,None,True),
    ("4010","Glass Sales",AccountType.income,"4000",True),
    ("4020","Mirror Sales",AccountType.income,"4000",False),
    ("4030","Processed Glass Sales",AccountType.income,"4000",False),
    ("4100","Shipping Income",AccountType.income,None,False),
    ("4200","Other Income",AccountType.income,None,False),
    ("4201","Recharge Commission - Jio",AccountType.income,None,False),
    ("4202","Recharge Commission - Airtel",AccountType.income,None,False),
    ("4203","Recharge Commission - Vi",AccountType.income,None,False),
    ("4204","Recharge Commission - BSNL",AccountType.income,None,False),
    ("4210","Discount Received",AccountType.income,"4200",False),
    ("4900","Round Off",AccountType.income,None,False),
    ("5000","Cost of Goods Sold",AccountType.expense,None,True),
    ("5010","Purchase — Glass",AccountType.expense,"5000",True),
    ("5020","Purchase — Frames & Fittings",AccountType.expense,"5000",False),
    ("5030","Freight Inward",AccountType.expense,"5000",False),
    ("5100","Operating Expenses",AccountType.expense,None,True),
    ("5110","Rent",AccountType.expense,"5100",False),
    ("5120","Electricity",AccountType.expense,"5100",False),
    ("5130","Salaries & Wages",AccountType.expense,"5100",False),
    ("5140","Transport & Delivery",AccountType.expense,"5100",False),
    ("5150","Packing Materials",AccountType.expense,"5100",False),
    ("5200","Selling & Admin Expenses",AccountType.expense,None,False),
    ("5210","Advertisement",AccountType.expense,"5200",False),
    ("5220","Bank Charges",AccountType.expense,"5200",False),
    ("5230","Discount Allowed",AccountType.expense,"5200",False),
    ("5300","Depreciation",AccountType.expense,None,False),
]


async def seed_accounts(db: AsyncSession) -> None:
    """
    Idempotent seeder — safe to call on every app startup.

    - Inserts any account from ACCOUNTS that doesn't exist yet (matched by code).
    - Leaves existing accounts untouched (so manual edits / renames survive restarts).
    - Fixes up parent_id links for every account, including ones seeded earlier
      whose parent code was added later.
    """
    # Load all existing accounts in one query, keyed by code.
    result = await db.execute(select(Account))
    existing = {acc.code: acc for acc in result.scalars().all()}

    inserted = 0
    for code, name, atype, parent_code, is_system in ACCOUNTS:
        if code not in existing:
            acc = Account(
                code=code,
                name=name,
                account_type=atype,
                is_system=is_system,
                is_active=True,
            )
            db.add(acc)
            existing[code] = acc
            inserted += 1

    if inserted:
        # Flush so newly-added accounts get PKs we can use for parent linking.
        await db.flush()

    # Second pass: (re)link parents. Cheap, and covers the case where a
    # parent account is introduced in ACCOUNTS after its children already exist.
    for code, _name, _atype, parent_code, _is_system in ACCOUNTS:
        if not parent_code:
            continue
        acc = existing.get(code)
        parent = existing.get(parent_code)
        if acc and parent and acc.parent_id != parent.id:
            acc.parent_id = parent.id

    if inserted:
        await db.flush()
        print(f"✓ Seeded {inserted} new account(s) (total defined: {len(ACCOUNTS)})")
    else:
        print("✓ Account seed check: nothing new to add")