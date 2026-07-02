from fastapi import APIRouter
from app.api.v1.endpoints import (
    settings,
    images,
    auth, users, products, categories, cart, orders,
    coupons, payments, admin,journals,
    sales_invoices, sales_returns, accounting, reports,stock_transactions
)

router = APIRouter()
router.include_router(auth.router,           prefix="/auth",             tags=["Auth"])
router.include_router(users.router,          prefix="/users",            tags=["Users"])
router.include_router(categories.router,     prefix="/categories",       tags=["Categories"])
router.include_router(products.router,       prefix="/products",         tags=["Products"])
router.include_router(cart.router,           prefix="/cart",             tags=["Cart"])
router.include_router(coupons.router,        prefix="/coupons",          tags=["Coupons"])
router.include_router(orders.router,         prefix="/orders",           tags=["Orders"])
router.include_router(payments.router,       prefix="/payments",         tags=["Payments"])
router.include_router(admin.router,          prefix="/admin",            tags=["Admin"])
router.include_router(stock_transactions.router, prefix="/products", tags=["Stock Transactions"])

# ── Accounting ──────────────────────────
router.include_router(settings.router,     prefix="/settings",        tags=["Company Settings"])
router.include_router(images.router,       prefix="/products",        tags=["Product Images"])
router.include_router(sales_invoices.router, prefix="/invoices",         tags=["Sales Invoices"])
router.include_router(sales_returns.router,  prefix="/sales-returns",    tags=["Sales Returns"])
router.include_router(accounting.vendors_router,  prefix="/vendors",     tags=["Vendors"])
router.include_router(accounting.purchase_router, prefix="/purchases",   tags=["Purchases"])
router.include_router(accounting.pr_router,       prefix="/purchase-returns", tags=["Purchase Returns"])
router.include_router(accounting.receipt_router,  prefix="/receipts",    tags=["Receipts"])
router.include_router(accounting.payment_v_router,prefix="/payment-vouchers", tags=["Payment Vouchers"])
router.include_router(accounting.accounting_router, prefix="/accounting", tags=["Accounting"])
router.include_router(reports.router,        prefix="/reports",          tags=["Reports"])
router.include_router(reports.gst_router,    prefix="/gst",              tags=["GST Returns"])
router.include_router(journals.router, prefix="/journals", tags=["Journals"])

