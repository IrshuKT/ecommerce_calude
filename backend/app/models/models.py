import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Text, Boolean, Integer, Numeric, DateTime, Enum,
    ForeignKey, JSON, UniqueConstraint, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base



class UserRole(str, enum.Enum):
    customer = "customer"
    admin = "admin"


class OrderStatus(str, enum.Enum):
    placed = "placed"
    confirmed = "confirmed"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    cod = "cod"
    razorpay = "razorpay"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class CouponType(str, enum.Enum):
    percentage = "percentage"
    fixed = "fixed"


class PriceType(str, enum.Enum):
    fixed = "fixed"
    per_sqft = "per_sqft"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.customer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_trade_approved : Mapped[bool] = mapped_column(Boolean,default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    addresses: Mapped[List["Address"]] = relationship("Address", back_populates="user")
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="user")
    cart_items: Mapped[List["CartItem"]] = relationship("CartItem", back_populates="user")

class InternalRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    sales = "sales"
    inventory = "inventory"

"""  """
class InternalUser(Base):
    __tablename__ = "internal_users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(15), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[InternalRole] = mapped_column(Enum(InternalRole), default=InternalRole.sales)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    stock_transactions: Mapped[List["StockTransaction"]] = relationship(
        "StockTransaction", back_populates="created_by")

class Address(Base):
    __tablename__ = "addresses"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    label: Mapped[Optional[str]] = mapped_column(String(50))
    full_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(15))
    line1: Mapped[str] = mapped_column(String(255))
    line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    state_code: Mapped[str] = mapped_column(String(5))
    pincode: Mapped[str] = mapped_column(String(10))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    user: Mapped["User"] = relationship("User", back_populates="addresses")


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    image_url: Mapped[Optional[str]] = mapped_column(String(500))
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    parent: Mapped[Optional["Category"]] = relationship("Category", remote_side="Category.id")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")


class ProductType(str, enum.Enum):
    product = "product"
    service = "service"

class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("categories.id"))
    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    short_description: Mapped[Optional[str]] = mapped_column(String(500))
    hsn_code: Mapped[Optional[str]] = mapped_column(String(20))
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=18.00)
    price_type: Mapped[PriceType] = mapped_column(Enum(PriceType), default=PriceType.fixed)
    item_type: Mapped[ProductType] = mapped_column(Enum(ProductType), default=ProductType.product)  # ← new
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="products")
    attributes: Mapped[List["ProductAttribute"]] = relationship("ProductAttribute", back_populates="product", cascade="all, delete-orphan")
    variants: Mapped[List["ProductVariant"]] = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images: Mapped[List["ProductImage"]] = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")

class ProductAttribute(Base):
    __tablename__ = "product_attributes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100))
    display_name: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    product: Mapped["Product"] = relationship("Product", back_populates="attributes")
    values: Mapped[List["ProductAttributeValue"]] = relationship("ProductAttributeValue", back_populates="attribute", cascade="all, delete-orphan")


class ProductAttributeValue(Base):
    __tablename__ = "product_attribute_values"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attribute_id: Mapped[int] = mapped_column(ForeignKey("product_attributes.id", ondelete="CASCADE"))
    value: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    attribute: Mapped["ProductAttribute"] = relationship("ProductAttribute", back_populates="values")


class ProductVariant(Base):
    __tablename__ = "product_variants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    sku: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    selected_attributes: Mapped[dict] = mapped_column(JSON, default=dict)
    width_ft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    height_ft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    retail_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    trade_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)   # ← changed
    compare_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    cost_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    stock_qty: Mapped[int] = mapped_column(Integer, default=0)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=5)
    track_inventory: Mapped[bool] = mapped_column(Boolean, default=True)
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 3))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    product: Mapped["Product"] = relationship("Product", back_populates="variants")
    cart_items: Mapped[List["CartItem"]] = relationship("CartItem", back_populates="variant")
    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="variant")

    
class ProductImage(Base):
    __tablename__ = "product_images"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(500))
    alt_text: Mapped[Optional[str]] = mapped_column(String(200))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    product: Mapped["Product"] = relationship("Product", back_populates="images")


class CartItem(Base):
    __tablename__ = "cart_items"
    __table_args__ = (UniqueConstraint("user_id", "variant_id", name="uq_cart_user_variant"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    custom_width_ft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    custom_height_ft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    user: Mapped["User"] = relationship("User", back_populates="cart_items")
    variant: Mapped["ProductVariant"] = relationship("ProductVariant", back_populates="cart_items")


class Coupon(Base):
    __tablename__ = "coupons"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    coupon_type: Mapped[CouponType] = mapped_column(Enum(CouponType))
    value: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    min_order_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    max_discount_amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    usage_limit: Mapped[Optional[int]] = mapped_column(Integer)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    valid_from: Mapped[Optional[datetime]] = mapped_column(DateTime)
    valid_until: Mapped[Optional[datetime]] = mapped_column(DateTime)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="coupon")


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    coupon_id: Mapped[Optional[int]] = mapped_column(ForeignKey("coupons.id"))
    shipping_name: Mapped[str] = mapped_column(String(100))
    shipping_phone: Mapped[str] = mapped_column(String(15))
    shipping_line1: Mapped[str] = mapped_column(String(255))
    shipping_line2: Mapped[Optional[str]] = mapped_column(String(255))
    shipping_city: Mapped[str] = mapped_column(String(100))
    shipping_state: Mapped[str] = mapped_column(String(100))
    shipping_state_code: Mapped[str] = mapped_column(String(5))
    shipping_pincode: Mapped[str] = mapped_column(String(10))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    cgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    sgst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    igst_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    shipping_charge: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    is_interstate: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.placed)
    payment_method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod))
    payment_status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending)
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(100))
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    user: Mapped["User"] = relationship("User", back_populates="orders")
    coupon: Mapped[Optional["Coupon"]] = relationship("Coupon", back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    tracking: Mapped[List["OrderTracking"]] = relationship("OrderTracking", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id"))
    product_name: Mapped[str] = mapped_column(String(200))
    variant_sku: Mapped[str] = mapped_column(String(100))
    selected_attributes: Mapped[dict] = mapped_column(JSON)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer)
    custom_width_ft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    custom_height_ft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    area_sqft: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    line_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    order: Mapped["Order"] = relationship("Order", back_populates="items")
    variant: Mapped["ProductVariant"] = relationship("ProductVariant", back_populates="order_items")


class OrderTracking(Base):
    __tablename__ = "order_tracking"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus))
    message: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    order: Mapped["Order"] = relationship("Order", back_populates="tracking")



class CompanySettings(Base):
    __tablename__ = "company_settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200), default="GlassStore")
    tagline: Mapped[Optional[str]] = mapped_column(String(300))
    logo_url: Mapped[Optional[str]] = mapped_column(String(500))
    email: Mapped[Optional[str]] = mapped_column(String(150))
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    mobile: Mapped[Optional[str]] = mapped_column(String(20))
    address_line1: Mapped[Optional[str]] = mapped_column(String(255))
    address_line2: Mapped[Optional[str]] = mapped_column(String(255))
    city: Mapped[Optional[str]] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100), default="Kerala")
    state_code: Mapped[str] = mapped_column(String(5), default="32")
    pincode: Mapped[Optional[str]] = mapped_column(String(10))
    country: Mapped[str] = mapped_column(String(50), default="India")
    gstin: Mapped[Optional[str]] = mapped_column(String(20))
    pan: Mapped[Optional[str]] = mapped_column(String(12))
    bank_name: Mapped[Optional[str]] = mapped_column(String(100))
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(30))
    bank_ifsc: Mapped[Optional[str]] = mapped_column(String(20))
    bank_branch: Mapped[Optional[str]] = mapped_column(String(100))
    invoice_prefix: Mapped[str] = mapped_column(String(10), default="INV")
    invoice_terms: Mapped[Optional[str]] = mapped_column(String(500))
    invoice_footer: Mapped[Optional[str]] = mapped_column(String(300))
    website: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())


class StockTxnType(str, enum.Enum):
    in_ = "in"
    out = "out"
    adjustment = "adjustment"


class StockTransaction(Base):
    __tablename__ = "stock_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    variant_id: Mapped[int] = mapped_column(ForeignKey("product_variants.id", ondelete="CASCADE"), index=True)
    txn_type: Mapped[StockTxnType] = mapped_column(
        Enum(StockTxnType, values_callable=lambda x: [e.value for e in x])
    )
    qty_change: Mapped[int] = mapped_column(Integer)
    qty_before: Mapped[int] = mapped_column(Integer)
    qty_after: Mapped[int] = mapped_column(Integer)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50))
    reference_id: Mapped[Optional[str]] = mapped_column(String(100))
    note: Mapped[Optional[str]] = mapped_column(String(500))
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("internal_users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    variant: Mapped["ProductVariant"] = relationship("ProductVariant")
    created_by: Mapped[Optional["InternalUser"]] = relationship(
        "InternalUser", back_populates="stock_transactions"
    )