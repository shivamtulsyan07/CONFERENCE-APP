from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from bson import ObjectId
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def oid(value: str):
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail="Invalid id")
    return ObjectId(value)


class BaseDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: Optional[str] = Field(default=None)

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


STATUS = Literal["not_ready", "arrived", "ready"]


# ---------- Parties ----------
class Party(BaseDocument):
    name: str
    page: str = ""
    phone: str = ""
    city: str = ""
    created_at: str = Field(default_factory=now_iso)


class PartyCreate(BaseModel):
    name: str
    page: str = ""
    phone: str = ""
    city: str = ""


# ---------- Order sheet row ----------
class OrderRow(BaseDocument):
    party_name: str = ""
    page: str = ""
    conference: str = ""
    item: str = ""
    shade: str = ""
    qty: float = 0
    mtr: str = ""
    rate: float = 0
    amount: float = 0
    bill_no: str = ""
    status: STATUS = "not_ready"
    row_index: int = 0
    created_at: str = Field(default_factory=now_iso)


class OrderRowIn(BaseModel):
    id: Optional[str] = None
    party_name: str = ""
    page: str = ""
    conference: str = ""
    item: str = ""
    shade: str = ""
    qty: float = 0
    mtr: str = ""
    rate: float = 0
    amount: float = 0
    bill_no: str = ""
    status: STATUS = "not_ready"
    row_index: int = 0


# ---------- Stock sheet row ----------
class StockRow(BaseDocument):
    conference: str = ""
    item: str = ""
    shade: str = ""
    quantity: float = 0
    row_index: int = 0
    created_at: str = Field(default_factory=now_iso)


class StockRowIn(BaseModel):
    id: Optional[str] = None
    conference: str = ""
    item: str = ""
    shade: str = ""
    quantity: float = 0
    row_index: int = 0


class BulkOrderRows(BaseModel):
    rows: List[OrderRowIn]


class BulkStockRows(BaseModel):
    rows: List[StockRowIn]


def is_blank_order(r: OrderRowIn):
    return not any([r.party_name.strip(), r.item.strip(), r.shade.strip(), r.bill_no.strip(), r.qty, r.rate])


def is_blank_stock(r: StockRowIn):
    return not any([r.conference.strip(), r.item.strip(), r.shade.strip(), r.quantity])


# ---------- Parties API ----------
@api_router.get("/parties", response_model=List[Party])
async def list_parties():
    docs = await db.parties.find().sort("name", 1).to_list(2000)
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


# ---------- Order sheet API ----------
@api_router.get("/order-rows", response_model=List[OrderRow])
async def list_order_rows():
    docs = await db.order_rows.find().sort([("row_index", 1), ("created_at", 1)]).to_list(5000)
    return [OrderRow.from_mongo(d) for d in docs]


@api_router.post("/order-rows/bulk", response_model=List[OrderRow])
async def save_order_rows(payload: BulkOrderRows):
    for r in payload.rows:
        if is_blank_order(r):
            continue
        data = r.model_dump(exclude={"id"})
        if r.qty and r.rate and not r.amount:
            data["amount"] = r.qty * r.rate
        if r.id:
            await db.order_rows.update_one({"_id": oid(r.id)}, {"$set": data})
        else:
            data["created_at"] = now_iso()
            await db.order_rows.insert_one(data)
    return await list_order_rows()


@api_router.delete("/order-rows/{row_id}")
async def delete_order_row(row_id: str):
    await db.order_rows.delete_one({"_id": oid(row_id)})
    return {"ok": True}


@api_router.post("/order-rows/auto-status", response_model=List[OrderRow])
async def auto_status():
    stock = await db.stock_rows.find().to_list(5000)
    available = {}
    for s in stock:
        key = (s.get("item", "").strip().upper(), str(s.get("shade", "")).strip())
        available[key] = available.get(key, 0) + (s.get("quantity") or 0)

    updated = 0
    rows = await db.order_rows.find().to_list(5000)
    for r in rows:
        key = (r.get("item", "").strip().upper(), str(r.get("shade", "")).strip())
        have = available.get(key, 0)
        need = r.get("qty") or 0
        if have <= 0:
            status = "not_ready"
        elif have >= need:
            status = "ready"
        else:
            status = "arrived"
        if status != r.get("status"):
            await db.order_rows.update_one({"_id": r["_id"]}, {"$set": {"status": status}})
            updated += 1
    return await list_order_rows()


# ---------- Stock sheet API ----------
@api_router.get("/stock-rows", response_model=List[StockRow])
async def list_stock_rows():
    docs = await db.stock_rows.find().sort([("row_index", 1), ("created_at", 1)]).to_list(5000)
    return [StockRow.from_mongo(d) for d in docs]


@api_router.post("/stock-rows/bulk", response_model=List[StockRow])
async def save_stock_rows(payload: BulkStockRows):
    for r in payload.rows:
        if is_blank_stock(r):
            continue
        data = r.model_dump(exclude={"id"})
        if r.id:
            await db.stock_rows.update_one({"_id": oid(r.id)}, {"$set": data})
        else:
            data["created_at"] = now_iso()
            await db.stock_rows.insert_one(data)
    return await list_stock_rows()


@api_router.delete("/stock-rows/{row_id}")
async def delete_stock_row(row_id: str):
    await db.stock_rows.delete_one({"_id": oid(row_id)})
    return {"ok": True}


# ---------- Lookups ----------
@api_router.get("/lookups")
async def lookups():
    parties = await db.parties.find().to_list(2000)
    order_rows = await db.order_rows.find().to_list(5000)
    stock_rows = await db.stock_rows.find().to_list(5000)

    def uniq(values):
        return sorted({str(v).strip() for v in values if str(v).strip()})

    return {
        "parties": uniq([p["name"] for p in parties] + [r.get("party_name", "") for r in order_rows]),
        "party_pages": {
            p["name"]: p.get("page", "") for p in parties if p.get("page")
        },
        "conferences": uniq([r.get("conference", "") for r in order_rows] + [r.get("conference", "") for r in stock_rows] + ["SH ROLL"]),
        "items": uniq([r.get("item", "") for r in order_rows] + [r.get("item", "") for r in stock_rows]),
        "shades": uniq([r.get("shade", "") for r in order_rows] + [r.get("shade", "") for r in stock_rows]),
        "bill_nos": uniq([r.get("bill_no", "") for r in order_rows]),
    }


# ---------- Dashboard ----------
@api_router.get("/stats/dashboard")
async def dashboard_stats():
    rows = await db.order_rows.find().to_list(5000)
    stock = await db.stock_rows.find().to_list(5000)

    status_counts = {"not_ready": 0, "arrived": 0, "ready": 0}
    party_wise = {}
    total_qty = 0
    total_amount = 0
    billed = 0
    for r in rows:
        st = r.get("status", "not_ready")
        status_counts[st] = status_counts.get(st, 0) + 1
        qty = r.get("qty") or 0
        total_qty += qty
        total_amount += r.get("amount") or 0
        if str(r.get("bill_no", "")).strip():
            billed += 1
        party = r.get("party_name", "").strip() or "—"
        e = party_wise.setdefault(party, {"party": party, "rows": 0, "qty": 0, "ready": 0, "pending": 0})
        e["rows"] += 1
        e["qty"] += qty
        if st == "ready":
            e["ready"] += 1
        else:
            e["pending"] += 1

    item_wise = {}
    for r in rows:
        item = r.get("item", "").strip()
        if not item:
            continue
        e = item_wise.setdefault(item, {"item": item, "qty": 0})
        e["qty"] += r.get("qty") or 0

    return {
        "total_rows": len(rows),
        "total_qty": total_qty,
        "total_amount": total_amount,
        "billed_rows": billed,
        "unbilled_rows": len(rows) - billed,
        "status_counts": status_counts,
        "stock_lines": len(stock),
        "stock_qty": sum(s.get("quantity") or 0 for s in stock),
        "parties": await db.parties.count_documents({}),
        "party_wise": sorted(party_wise.values(), key=lambda x: -x["qty"])[:8],
        "item_wise": sorted(item_wise.values(), key=lambda x: -x["qty"])[:8],
    }


@api_router.post("/seed")
async def seed():
    if await db.order_rows.count_documents({}) > 0:
        return {"seeded": False, "message": "Data already present"}
    await db.parties.delete_many({})
    await db.parties.insert_many([
        {"name": "SRI RAM VASTRALAYA, BHELAHI", "page": "36", "phone": "", "city": "", "created_at": now_iso()},
        {"name": "CHAUDHARY VASTRALAYA, DARDHA", "page": "60", "phone": "", "city": "", "created_at": now_iso()},
        {"name": "TRILOK VASTRALAYA, LAKHORA", "page": "37", "phone": "", "city": "", "created_at": now_iso()},
    ])
    orders = [
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-URBAN LYCRA", "701", 1, "12.80*1", "AS/58", "ready"),
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-URBAN LYCRA", "102", 1, "12.80*1", "AS/58", "ready"),
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-URBAN LYCRA", "107", 1, "11.20*1", "", "arrived"),
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-FORTUNER", "701", 1, "14.40*1", "AS/58", "ready"),
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-WAGON", "102", 1, "", "", "not_ready"),
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-WAGON", "108", 1, "9.60*1", "AS/56", "ready"),
        ("SRI RAM VASTRALAYA, BHELAHI", "36", "V-WAGON", "114", 1, "11.20*1", "", "arrived"),
        ("CHAUDHARY VASTRALAYA, DARDHA", "60", "V-LINEN STUDIO", "6305", 1, "8*1", "", "arrived"),
        ("CHAUDHARY VASTRALAYA, DARDHA", "60", "V-LINEN STUDIO", "6325", 1, "", "", "not_ready"),
        ("TRILOK VASTRALAYA, LAKHORA", "37", "V-HARRIER WHITE-1", "701", 1, "16*1", "", "arrived"),
        ("TRILOK VASTRALAYA, LAKHORA", "37", "V-TRIBER -5", "501", 1, "", "", "not_ready"),
    ]
    await db.order_rows.insert_many([
        {
            "party_name": p, "page": pg, "conference": "SH ROLL", "item": item, "shade": shade,
            "qty": qty, "mtr": mtr, "rate": 0, "amount": 0, "bill_no": bill,
            "status": st, "row_index": idx, "created_at": now_iso(),
        }
        for idx, (p, pg, item, shade, qty, mtr, bill, st) in enumerate(orders)
    ])
    stock = [
        ("LOYAL PRINT CS", "121"), ("LOYAL PRINT CS", "123"), ("LOYAL PRINT CS", "126"),
        ("CUBA PRINT CS", "1872"), ("CUBA PRINT CS", "1873"), ("CUBA PRINT CS", "1916"),
        ("SENSATIONAL CS", "211"), ("SENSATIONAL CS", "212"),
    ]
    await db.stock_rows.insert_many([
        {"conference": "SH ROLL", "item": i, "shade": s, "quantity": 3, "row_index": idx, "created_at": now_iso()}
        for idx, (i, s) in enumerate(stock)
    ])
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
