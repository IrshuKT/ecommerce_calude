from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, products, categories, cart, orders, coupons, payments, admin

router = APIRouter()
router.include_router(auth.router,       prefix="/auth",       tags=["Auth"])
router.include_router(users.router,      prefix="/users",      tags=["Users"])
router.include_router(categories.router, prefix="/categories", tags=["Categories"])
router.include_router(products.router,   prefix="/products",   tags=["Products"])
router.include_router(cart.router,       prefix="/cart",       tags=["Cart"])
router.include_router(coupons.router,    prefix="/coupons",    tags=["Coupons"])
router.include_router(orders.router,     prefix="/orders",     tags=["Orders"])
router.include_router(payments.router,   prefix="/payments",   tags=["Payments"])
router.include_router(admin.router,      prefix="/admin",      tags=["Admin"])
