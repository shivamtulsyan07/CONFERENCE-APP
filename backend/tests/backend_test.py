"""Backend tests for the Order Sheet / Stock Sheet Excel-like app (iteration 2)."""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- seed ----------
@pytest.fixture(scope="session", autouse=True)
def _seed(s):
    r = s.post(f"{API}/seed")
    assert r.status_code == 200
    return r.json()


class TestSeed:
    def test_seed_idempotent(self, s):
        r = s.post(f"{API}/seed")
        assert r.status_code == 200
        data = r.json()
        assert data.get("seeded") is False
        assert "already" in data.get("message", "").lower()


# ---------- Parties ----------
class TestParties:
    def test_seeded_parties(self, s):
        parties = s.get(f"{API}/parties").json()
        names = {p["name"] for p in parties}
        assert "SRI RAM VASTRALAYA, BHELAHI" in names
        assert "CHAUDHARY VASTRALAYA, DARDHA" in names
        # verify id field (not _id)
        for p in parties:
            assert "id" in p and "_id" not in p

    def test_create_and_delete_party(self, s):
        r = s.post(f"{API}/parties", json={"name": "TEST_PARTY_X", "page": "99"})
        assert r.status_code == 200
        pid = r.json()["id"]
        assert r.json()["page"] == "99"
        # verify in list
        assert any(p["id"] == pid for p in s.get(f"{API}/parties").json())
        r = s.delete(f"{API}/parties/{pid}")
        assert r.status_code == 200


# ---------- Lookups ----------
class TestLookups:
    def test_lookups_shape_and_party_pages(self, s):
        r = s.get(f"{API}/lookups")
        assert r.status_code == 200
        lk = r.json()
        for k in ["parties", "party_pages", "groups", "items", "shades", "bill_nos"]:
            assert k in lk
        assert lk["party_pages"].get("SRI RAM VASTRALAYA, BHELAHI") == "36"
        assert lk["party_pages"].get("CHAUDHARY VASTRALAYA, DARDHA") == "60"
        assert "SH ROLL" in lk["groups"]


# ---------- Order rows bulk / persistence / update / delete ----------
class TestOrderRows:
    def test_list_returns_id_not_underscore(self, s):
        rows = s.get(f"{API}/order-rows").json()
        assert len(rows) > 0
        for r in rows[:3]:
            assert "id" in r and "_id" not in r

    def test_bulk_insert_and_persistence(self, s):
        payload = {"rows": [
            {"party_name": "TEST_BULK_A", "page": "1", "group": "SH ROLL",
             "item": "TEST_ITEM_A", "shade": "111", "qty": 2, "rate": 100,
             "bill_no": "TB/1", "status": "not_ready", "row_index": 900}
        ]}
        r = s.post(f"{API}/order-rows/bulk", json=payload)
        assert r.status_code == 200, r.text
        rows = r.json()
        created = [x for x in rows if x["party_name"] == "TEST_BULK_A"]
        assert len(created) == 1
        row = created[0]
        # amount auto-fill
        assert row["amount"] == 200
        assert row["qty"] == 2

        # verify GET persistence
        rows2 = s.get(f"{API}/order-rows").json()
        assert any(x["id"] == row["id"] for x in rows2)

        # cleanup
        s.delete(f"{API}/order-rows/{row['id']}")

    def test_blank_rows_skipped(self, s):
        before = len(s.get(f"{API}/order-rows").json())
        r = s.post(f"{API}/order-rows/bulk", json={"rows": [
            {"party_name": "", "item": "", "shade": "", "qty": 0, "rate": 0, "bill_no": ""},
            {"party_name": "  ", "item": " ", "shade": "", "qty": 0, "rate": 0, "bill_no": ""},
        ]})
        assert r.status_code == 200
        after = len(s.get(f"{API}/order-rows").json())
        assert before == after

    def test_update_existing_row_no_duplicate(self, s):
        # create one
        r = s.post(f"{API}/order-rows/bulk", json={"rows": [
            {"party_name": "TEST_UPD", "item": "UPD_ITEM", "shade": "1", "qty": 1, "rate": 10, "bill_no": ""}
        ]})
        rid = [x for x in r.json() if x["party_name"] == "TEST_UPD"][0]["id"]
        before_count = len(s.get(f"{API}/order-rows").json())

        # update it with id
        r = s.post(f"{API}/order-rows/bulk", json={"rows": [
            {"id": rid, "party_name": "TEST_UPD", "item": "UPD_ITEM", "shade": "1",
             "qty": 5, "rate": 10, "bill_no": "B/9", "status": "ready"}
        ]})
        assert r.status_code == 200
        after_count = len(s.get(f"{API}/order-rows").json())
        assert before_count == after_count  # no dup

        # verify GET updated data
        updated = [x for x in s.get(f"{API}/order-rows").json() if x["id"] == rid][0]
        assert updated["qty"] == 5
        assert updated["bill_no"] == "B/9"
        assert updated["status"] == "ready"

        s.delete(f"{API}/order-rows/{rid}")

    def test_delete_row(self, s):
        r = s.post(f"{API}/order-rows/bulk", json={"rows": [
            {"party_name": "TEST_DEL", "item": "X", "shade": "1", "qty": 1, "rate": 1, "bill_no": ""}
        ]})
        rid = [x for x in r.json() if x["party_name"] == "TEST_DEL"][0]["id"]
        r = s.delete(f"{API}/order-rows/{rid}")
        assert r.status_code == 200
        assert not any(x["id"] == rid for x in s.get(f"{API}/order-rows").json())


# ---------- Auto status ----------
class TestAutoStatus:
    def test_auto_status_matches_stock(self, s):
        # Create order needing an item with matching stock
        # Stock seed has ("LOYAL PRINT CS", "121") qty=3
        r = s.post(f"{API}/order-rows/bulk", json={"rows": [
            {"party_name": "TEST_AS_READY", "item": "LOYAL PRINT CS", "shade": "121",
             "qty": 2, "rate": 0, "bill_no": ""},  # need 2, have 3 -> ready
            {"party_name": "TEST_AS_ARR", "item": "LOYAL PRINT CS", "shade": "123",
             "qty": 10, "rate": 0, "bill_no": ""},  # need 10, have 3 -> arrived
            {"party_name": "TEST_AS_NR", "item": "NOSUCH", "shade": "999",
             "qty": 1, "rate": 0, "bill_no": ""},  # not present -> not_ready
        ]})
        assert r.status_code == 200
        ids = {x["party_name"]: x["id"] for x in r.json() if x["party_name"].startswith("TEST_AS_")}
        r = s.post(f"{API}/order-rows/auto-status")
        assert r.status_code == 200
        rows = {x["id"]: x for x in r.json()}
        assert rows[ids["TEST_AS_READY"]]["status"] == "ready"
        assert rows[ids["TEST_AS_ARR"]]["status"] == "arrived"
        assert rows[ids["TEST_AS_NR"]]["status"] == "not_ready"
        for rid in ids.values():
            s.delete(f"{API}/order-rows/{rid}")


# ---------- Stock rows ----------
class TestStockRows:
    def test_stock_bulk_and_delete(self, s):
        r = s.post(f"{API}/stock-rows/bulk", json={"rows": [
            {"group": "SH ROLL", "item": "TEST_STK", "shade": "S1", "quantity": 5, "row_index": 800}
        ]})
        assert r.status_code == 200
        created = [x for x in r.json() if x["item"] == "TEST_STK"]
        assert len(created) == 1
        sid = created[0]["id"]
        assert created[0]["quantity"] == 5

        # blank-row skip
        before = len(s.get(f"{API}/stock-rows").json())
        r = s.post(f"{API}/stock-rows/bulk", json={"rows": [
            {"group": "", "item": "", "shade": "", "quantity": 0}
        ]})
        assert r.status_code == 200
        assert len(s.get(f"{API}/stock-rows").json()) == before

        r = s.delete(f"{API}/stock-rows/{sid}")
        assert r.status_code == 200
        assert not any(x["id"] == sid for x in s.get(f"{API}/stock-rows").json())


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_shape(self, s):
        r = s.get(f"{API}/stats/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_rows", "total_qty", "total_amount", "billed_rows",
                  "unbilled_rows", "status_counts", "stock_lines", "stock_qty",
                  "parties", "party_wise", "item_wise"]:
            assert k in d
        assert set(d["status_counts"].keys()) >= {"not_ready", "arrived", "ready"}
        assert d["total_rows"] > 0
