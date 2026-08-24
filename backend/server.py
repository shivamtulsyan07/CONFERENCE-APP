from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, BeforeValidator
from typing import List, Optional, Annotated, Literal
from bson import ObjectId
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v))]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")
    id: Optional[PyObjectId] = Field(default=None)

    def to_mongo(self):
        doc = self.model_dump(exclude_none=True)
        doc.pop("id", None)
        return doc

    @classmethod
    def from_mongo(cls, doc):
        if doc is None:
            return None
        d = dict(doc)
        if "_id" in d:
            d["id"] = str(d.pop("_id"))
        return cls(**d)


# ---------- Models ----------
class Party(BaseDocument):
    name: str
    phone: str = ""
    city: str = ""
    gst: str = ""
    created_at: str = Field(default_factory=now_iso)


class PartyCreate(BaseModel):
    name: str
    phone: str = ""
    city: str = ""
    gst: str = ""


class Product(BaseDocument):
    name: str
    sku: str = ""
    unit: str = "pcs"
    rate: float = 0
    shop_stock: float = 0
    low_stock_at: float = 10
    created_at: str = Field(default_factory=now_iso)


class ProductCreate(BaseModel):
    name: str
    sku: str = ""
    unit: str = "pcs"
    rate: float = 0
    shop_stock: float = 0
    low_stock_at: float = 10


class StockAdjust(BaseModel):
    delta: float
    note: str = ""


class OrderItem(BaseModel):
    product_id: str
    name: str
    qty: float
    rate: float = 0
    source: Literal["company", "shop"] = "company"
    dispatched_qty: float = 0


class Order(BaseDocument):
    order_no: str
    party_id: str
    party_name: str
    items: List[OrderItem] = []
    total: float = 0
    notes: str = ""
    status: str = "pending"  # pending | ordered_to_company | received | partial | dispatched
    created_at: str = Field(default_factory=now_iso)


class OrderCreate(BaseModel):
    party_id: str
    items: List[OrderItem]
    notes: str = ""


class POItem(BaseModel):
    product_id: str
    name: str
    qty: float
    received_qty: float = 0


class CompanyOrder(BaseDocument):
    po_no: str
    supplier: str
    items: List[POItem] = []
    order_ids: List[str] = []
    status: str = "placed"  # placed | partial | received
    created_at: str = Field(default_factory=now_iso)


class CompanyOrderCreate(BaseModel):
    supplier: str
    items: List[POItem]
    order_ids: List[str] = []


class ReceiveItem(BaseModel):
    product_id: str
    qty: float


class ReceivePayload(BaseModel):
    items: List[ReceiveItem]


class DispatchItem(BaseModel):
    product_id: str
    name: str
    qty: float


class Dispatch(BaseDocument):
    dispatch_no: str
    order_id: str
    party_id: str
    party_name: str
    items: List[DispatchItem] = []
    transport: str = ""
    created_at: str = Field(default_factory=now_iso)


class DispatchCreate(BaseModel):
    order_id: str
    items: List[DispatchItem]
    transport: str = ""


async def next_no(prefix: str, collection: str, field: str):
    count = await db[collection].count_documents({})
    return f"{prefix}-{1001 + count}"


def oid(value: str):
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail="Invalid id")
    return ObjectId(value)


# ---------- Parties ----------
@api_router.get("/parties", response_model=List[Party])
async def list_parties():
    docs = await db.parties.find().sort("name", 1).to_list(500)
    return [Party.from_mongo(d) for d in docs]


@api_router.post("/parties", response_model=Party)
async def create_party(payload: PartyCreate):
    party = Party(**payload.model_dump())
    res = await db.parties.insert_one(party.to_mongo())
    party.id = str(res.inserted_id)
    return party


@api_router.delete("/parties/{party_id}")
async def delete_party(party_id: str):
    await db.parties.delete_one({"_id": oid(party_id)})
    return {"ok": True}


# ---------- Products ----------
@api_router.get("/products", response_model=List[Product])
async def list_products():
    docs = await db.products.find().sort("name", 1).to_list(1000)
    return [Product.from_mongo(d) for d in docs]


@api_router.post("/products", response_model=Product)
async def create_product(payload: ProductCreate):
    product = Product(**payload.model_dump())
    res = await db.products.insert_one(product.to_mongo())
    product.id = str(res.inserted_id)
    return product


@api_router.patch("/products/{product_id}/stock", response_model=Product)
async def adjust_stock(product_id: str, payload: StockAdjust):
    doc = await db.products.find_one_and_update(
        {"_id": oid(product_id)},
        {"$inc": {"shop_stock": payload.delta}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product.from_mongo(doc)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    await db.products.delete_one({"_id": oid(product_id)})
    return {"ok": True}


# ---------- Orders ----------
@api_router.get("/orders", response_model=List[Order])
async def list_orders(status: Optional[str] = None):
    query = {"status": status} if status else {}
    docs = await db.orders.find(query).sort("created_at", -1).to_list(500)
    return [Order.from_mongo(d) for d in docs]


@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str):
    doc = await db.orders.find_one({"_id": oid(order_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return Order.from_mongo(doc)


@api_router.post("/orders", response_model=Order)
async def create_order(payload: OrderCreate):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")
    party = await db.parties.find_one({"_id": oid(payload.party_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    total = sum(i.qty * i.rate for i in payload.items)
    order = Order(
        order_no=await next_no("ORD", "orders", "order_no"),
        party_id=payload.party_id,
        party_name=party["name"],
        items=payload.items,
        total=total,
        notes=payload.notes,
    )
    res = await db.orders.insert_one(order.to_mongo())
    order.id = str(res.inserted_id)
    return order


@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str):
    await db.orders.delete_one({"_id": oid(order_id)})
    return {"ok": True}


# ---------- Company Orders (PO) ----------
@api_router.get("/company-orders", response_model=List[CompanyOrder])
async def list_company_orders():
    docs = await db.company_orders.find().sort("created_at", -1).to_list(500)
    return [CompanyOrder.from_mongo(d) for d in docs]


@api_router.post("/company-orders", response_model=CompanyOrder)
async def create_company_order(payload: CompanyOrderCreate):
    if not payload.items:
        raise HTTPException(status_code=400, detail="PO must have at least one item")
    po = CompanyOrder(
        po_no=await next_no("PO", "company_orders", "po_no"),
        supplier=payload.supplier,
        items=payload.items,
        order_ids=payload.order_ids,
    )
    res = await db.company_orders.insert_one(po.to_mongo())
    po.id = str(res.inserted_id)
    for order_id in payload.order_ids:
        await db.orders.update_one(
            {"_id": oid(order_id), "status": "pending"},
            {"$set": {"status": "ordered_to_company"}},
        )
    return po


@api_router.post("/company-orders/{po_id}/receive", response_model=CompanyOrder)
async def receive_company_order(po_id: str, payload: ReceivePayload):
    doc = await db.company_orders.find_one({"_id": oid(po_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="PO not found")
    po = CompanyOrder.from_mongo(doc)
    by_id = {i.product_id: i for i in po.items}
    to_apply = []
    for r in payload.items:
        item = by_id.get(r.product_id)
        if not item:
            raise HTTPException(status_code=400, detail=f"Item {r.product_id} not in PO")
        if r.qty <= 0:
            continue
        remaining = item.qty - item.received_qty
        if r.qty > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"{item.name}: receiving {r.qty} exceeds pending {remaining}",
            )
        to_apply.append((item, r.qty))
    for item, qty in to_apply:
        item.received_qty += qty
        await db.products.update_one(
            {"_id": oid(item.product_id)}, {"$inc": {"shop_stock": qty}}
        )
    fully = all(i.received_qty >= i.qty for i in po.items)
    any_recv = any(i.received_qty > 0 for i in po.items)
    po.status = "received" if fully else ("partial" if any_recv else "placed")
    await db.company_orders.update_one(
        {"_id": oid(po_id)},
        {"$set": {"items": [i.model_dump() for i in po.items], "status": po.status}},
    )
    if po.status == "received":
        for order_id in po.order_ids:
            await db.orders.update_one(
                {"_id": oid(order_id), "status": "ordered_to_company"},
                {"$set": {"status": "received"}},
            )
    return po


# ---------- Dispatch ----------
@api_router.get("/dispatches", response_model=List[Dispatch])
async def list_dispatches():
    docs = await db.dispatches.find().sort("created_at", -1).to_list(500)
    return [Dispatch.from_mongo(d) for d in docs]


@api_router.post("/dispatches", response_model=Dispatch)
async def create_dispatch(payload: DispatchCreate):
    doc = await db.orders.find_one({"_id": oid(payload.order_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    order = Order.from_mongo(doc)
    items = [i for i in payload.items if i.qty > 0]
    if not items:
        raise HTTPException(status_code=400, detail="Nothing to dispatch")

    order_items = {i.product_id: i for i in order.items}
    for d in items:
        oi = order_items.get(d.product_id)
        if not oi:
            raise HTTPException(status_code=400, detail=f"{d.name} not in this order")
        pending = oi.qty - oi.dispatched_qty
        if d.qty > pending:
            raise HTTPException(
                status_code=400, detail=f"{d.name}: dispatch qty exceeds pending {pending}"
            )
        prod = await db.products.find_one({"_id": oid(d.product_id)})
        if not prod:
            raise HTTPException(status_code=404, detail=f"Product {d.name} not found")
        if prod.get("shop_stock", 0) < d.qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient shop stock for {d.name} (available {prod.get('shop_stock', 0)})",
            )

    for d in items:
        await db.products.update_one(
            {"_id": oid(d.product_id)}, {"$inc": {"shop_stock": -d.qty}}
        )
        order_items[d.product_id].dispatched_qty += d.qty

    all_done = all(i.dispatched_qty >= i.qty for i in order.items)
    order.status = "dispatched" if all_done else "partial"
    await db.orders.update_one(
        {"_id": oid(payload.order_id)},
        {"$set": {"items": [i.model_dump() for i in order.items], "status": order.status}},
    )

    dispatch = Dispatch(
        dispatch_no=await next_no("DSP", "dispatches", "dispatch_no"),
        order_id=payload.order_id,
        party_id=order.party_id,
        party_name=order.party_name,
        items=items,
        transport=payload.transport,
    )
    res = await db.dispatches.insert_one(dispatch.to_mongo())
    dispatch.id = str(res.inserted_id)
    return dispatch


# ---------- Dashboard ----------
@api_router.get("/stats/dashboard")
async def dashboard_stats():
    orders = await db.orders.find().to_list(1000)
    products = await db.products.find().to_list(1000)
    dispatches = await db.dispatches.find().sort("created_at", -1).to_list(1000)

    total_sales = sum(o.get("total", 0) for o in orders)
    status_counts = {}
    for o in orders:
        status_counts[o["status"]] = status_counts.get(o["status"], 0) + 1

    low_stock = [
        {"name": p["name"], "shop_stock": p.get("shop_stock", 0), "low_stock_at": p.get("low_stock_at", 10)}
        for p in products
        if p.get("shop_stock", 0) <= p.get("low_stock_at", 10)
    ]

    party_wise = {}
    for d in dispatches:
        qty = sum(i["qty"] for i in d.get("items", []))
        entry = party_wise.setdefault(d["party_name"], {"party": d["party_name"], "dispatches": 0, "qty": 0})
        entry["dispatches"] += 1
        entry["qty"] += qty

    daily = {}
    for o in orders:
        day = o.get("created_at", "")[:10]
        entry = daily.setdefault(day, {"date": day, "orders": 0, "value": 0})
        entry["orders"] += 1
        entry["value"] += o.get("total", 0)

    return {
        "total_orders": len(orders),
        "total_sales": total_sales,
        "pending_dispatch": sum(1 for o in orders if o["status"] != "dispatched"),
        "total_dispatches": len(dispatches),
        "stock_units": sum(p.get("shop_stock", 0) for p in products),
        "products": len(products),
        "parties": await db.parties.count_documents({}),
        "status_counts": status_counts,
        "low_stock": low_stock,
        "party_wise": sorted(party_wise.values(), key=lambda x: -x["qty"])[:8],
        "daily": sorted(daily.values(), key=lambda x: x["date"])[-10:],
        "recent_dispatches": [
            {
                "dispatch_no": d["dispatch_no"],
                "party_name": d["party_name"],
                "qty": sum(i["qty"] for i in d.get("items", [])),
                "created_at": d.get("created_at"),
            }
            for d in dispatches[:6]
        ],
    }


@api_router.post("/seed")
async def seed():
    if await db.products.count_documents({}) > 0:
        return {"seeded": False, "message": "Data already present"}
    parties = [
        {"name": "Shree Traders", "phone": "9876543210", "city": "Surat", "gst": "24ABCDE1234F1Z5", "created_at": now_iso()},
        {"name": "Modern Enterprises", "phone": "9822012345", "city": "Pune", "gst": "27AACCM1234K1Z2", "created_at": now_iso()},
        {"name": "Kumar Agencies", "phone": "9911223344", "city": "Delhi", "gst": "07AAGCK5678L1Z9", "created_at": now_iso()},
    ]
    await db.parties.insert_many(parties)
    products = [
        {"name": "Conference Table 8ft", "sku": "CT-8", "unit": "pcs", "rate": 18500, "shop_stock": 6, "low_stock_at": 4, "created_at": now_iso()},
        {"name": "Executive Chair", "sku": "EC-01", "unit": "pcs", "rate": 6200, "shop_stock": 24, "low_stock_at": 10, "created_at": now_iso()},
        {"name": "Wireless Mic Set", "sku": "WM-04", "unit": "set", "rate": 9400, "shop_stock": 8, "low_stock_at": 5, "created_at": now_iso()},
        {"name": "Projector Screen 120in", "sku": "PS-120", "unit": "pcs", "rate": 7300, "shop_stock": 3, "low_stock_at": 5, "created_at": now_iso()},
    ]
    await db.products.insert_many(products)
    return {"seeded": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
