import enum
from app.models.models import InternalRole

class Menu(str, enum.Enum):
    dashboard = "dashboard"
    products = "products"
    orders = "orders"
    customers = "customers"
    stock = "stock"
    purchases = "purchases"
    reports = "reports"
    users = "users"
    settings = "settings"

ROLE_MENUS: dict[InternalRole, set[Menu]] = {
    InternalRole.admin:     set(Menu),
    InternalRole.manager:   {Menu.dashboard, Menu.products, Menu.orders, Menu.customers, Menu.stock, Menu.purchases, Menu.reports},
    InternalRole.sales:     {Menu.dashboard, Menu.orders, Menu.customers},
    InternalRole.inventory: {Menu.dashboard, Menu.products, Menu.stock, Menu.purchases},
}