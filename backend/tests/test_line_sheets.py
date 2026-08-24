"""Iteration 7 tests: Company Sent / Arrived line sheets + /company-balance.

New collections: company_sent_rows, company_arrived_rows (initially empty).
Endpoints tested:
  GET  /api/line-sheet/{sheet}
  POST /api/line-sheet/{sheet}/bulk
  POST /api/line-sheet/{sheet}/replace
  DELETE /api/line-sheet/{sheet}/{id}
  GET  /api/company-balance
Plus regression on existing literal routes (they must not be shadowed by /line-sheet).
"""
import os
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _cleanup(s, sheet):
    """Delete every row in the given line sheet (only used on QA collections)."""
    rows = s.get(f"{API}/line-sheet/{sheet}").json()
    for r in rows:
        s.delete(f"{API}/line-sheet/{sheet}/{r['id']}")


@pytest.fixture(autouse=True)
def _clean(s):
    # keep sent/arrived collections empty between tests (they are QA-owned).
    _cleanup(s, "company-sent-rows")
    _cleanup(s, "company-arrived-rows")
    yield
    _cleanup(s, "company-sent-rows")
    _cleanup(s, "company-arrived-rows")


# ---------- basic CRUD on line-sheet ----------
class TestLineSheets:
    def test_unknown_sheet_returns_404(self, s):
        r = s.get(f"{API}/line-sheet/does-not-exist")
        assert r.status_code == 404
        r2 = s.post(f"{API}/line-sheet/does-not-exist/bulk", json={"rows": []})
        assert r2.status_code == 404

    def test_list_empty(self, s):
        r = s.get(f"{API}/line-sheet/company-sent-rows")
        assert r.status_code == 200
        assert r.json() == []

    def test_bulk_create_shape_and_persistence(self, s):
        payload = {"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 10,
             "date": "2026-01-15", "remark": "TEST_line", "row_index": 0}
        ]}
        r = s.post(f"{API}/line-sheet/company-sent-rows/bulk", json=payload)
        assert r.status_code == 200, r.text
        saved = r.json()["saved"]
        assert len(saved) == 1
        rid = saved[0]["id"]
        assert isinstance(rid, str) and rid

        rows = s.get(f"{API}/line-sheet/company-sent-rows").json()
        assert len(rows) == 1
        assert rows[0]["id"] == rid
        assert rows[0]["item"] == "QA ITEM"
        assert rows[0]["quantity"] == 10
        assert "_id" not in rows[0]

    def test_blank_rows_are_skipped(self, s):
        r = s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "SH ROLL", "item": "", "shade": "", "quantity": 0, "remark": ""}
        ]})
        assert r.status_code == 200
        assert r.json()["saved"] == []
        assert s.get(f"{API}/line-sheet/company-sent-rows").json() == []

    def test_blank_row_with_id_deletes(self, s):
        r = s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"item": "QA X", "shade": "1", "quantity": 3}
        ]})
        rid = r.json()["saved"][0]["id"]
        r2 = s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"id": rid, "group": "SH ROLL", "item": "", "shade": "", "quantity": 0, "remark": ""}
        ]})
        assert r2.status_code == 200
        assert r2.json()["saved"] == []
        assert s.get(f"{API}/line-sheet/company-sent-rows").json() == []

    def test_replace_and_delete(self, s):
        r = s.post(f"{API}/line-sheet/company-arrived-rows/replace", json={"rows": [
            {"group": "G", "item": "I1", "shade": "1", "quantity": 2},
            {"group": "G", "item": "I2", "shade": "2", "quantity": 4},
            {"group": "G", "item": "", "shade": "", "quantity": 0},  # blank -> skipped
        ]})
        assert r.status_code == 200
        assert r.json()["count"] == 2
        rows = s.get(f"{API}/line-sheet/company-arrived-rows").json()
        assert len(rows) == 2

        # delete first
        s.delete(f"{API}/line-sheet/company-arrived-rows/{rows[0]['id']}")
        assert len(s.get(f"{API}/line-sheet/company-arrived-rows").json()) == 1


# ---------- Company Balance maths ----------
class TestCompanyBalance:
    def test_shape_empty(self, s):
        r = s.get(f"{API}/company-balance")
        assert r.status_code == 200
        d = r.json()
        for k in ["rows", "total_sent", "total_arrived", "total_balance", "pending_lines"]:
            assert k in d
        assert d["rows"] == []
        assert d["total_sent"] == 0

    def test_sent_then_partial_arrival(self, s):
        # sent 10
        s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 10}
        ]})
        # arrived 4
        s.post(f"{API}/line-sheet/company-arrived-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 4}
        ]})
        d = s.get(f"{API}/company-balance").json()
        assert len(d["rows"]) == 1
        row = d["rows"][0]
        assert row["group"].upper() == "QA GRP"
        assert row["item"].upper() == "QA ITEM"
        assert row["shade"] == "9"
        assert row["sent_qty"] == 10
        assert row["arrived_qty"] == 4
        assert row["balance_qty"] == 6
        assert d["total_sent"] == 10
        assert d["total_arrived"] == 4
        assert d["total_balance"] == 6
        assert d["pending_lines"] == 1

    def test_multiple_arrivals_accumulate_to_zero(self, s):
        s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 10}
        ]})
        s.post(f"{API}/line-sheet/company-arrived-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 4},
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 6},
        ]})
        d = s.get(f"{API}/company-balance").json()
        row = d["rows"][0]
        assert row["arrived_qty"] == 10
        assert row["balance_qty"] == 0
        assert d["pending_lines"] == 0

    def test_arrival_exceeding_sent_gives_negative_balance(self, s):
        s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 5}
        ]})
        s.post(f"{API}/line-sheet/company-arrived-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 8}
        ]})
        d = s.get(f"{API}/company-balance").json()
        row = d["rows"][0]
        assert row["balance_qty"] == -3
        assert d["pending_lines"] == 0  # pending only counts > 0

    def test_different_group_same_item_shade_are_separate(self, s):
        s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "G1", "item": "SAME ITEM", "shade": "9", "quantity": 5},
            {"group": "G2", "item": "SAME ITEM", "shade": "9", "quantity": 7},
        ]})
        s.post(f"{API}/line-sheet/company-arrived-rows/bulk", json={"rows": [
            {"group": "G1", "item": "SAME ITEM", "shade": "9", "quantity": 2}
        ]})
        d = s.get(f"{API}/company-balance").json()
        assert len(d["rows"]) == 2
        by_group = {r["group"]: r for r in d["rows"]}
        assert by_group["G1"]["balance_qty"] == 3
        assert by_group["G2"]["balance_qty"] == 7  # untouched by G1's arrival

    def test_deleting_arrival_restores_balance(self, s):
        s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 10}
        ]})
        rar = s.post(f"{API}/line-sheet/company-arrived-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 4}
        ]}).json()["saved"][0]["id"]
        assert s.get(f"{API}/company-balance").json()["rows"][0]["balance_qty"] == 6
        s.delete(f"{API}/line-sheet/company-arrived-rows/{rar}")
        d = s.get(f"{API}/company-balance").json()
        assert d["rows"][0]["balance_qty"] == 10
        assert d["total_arrived"] == 0

    def test_deleting_sent_removes_line(self, s):
        sid = s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"group": "QA GRP", "item": "QA ITEM", "shade": "9", "quantity": 10}
        ]}).json()["saved"][0]["id"]
        assert len(s.get(f"{API}/company-balance").json()["rows"]) == 1
        s.delete(f"{API}/line-sheet/company-sent-rows/{sid}")
        d = s.get(f"{API}/company-balance").json()
        assert d["rows"] == []
        assert d["total_sent"] == 0


# ---------- Regression: literal routes must not be shadowed by /line-sheet ----------
class TestRoutingRegression:
    def test_all_literal_routes_still_respond(self, s):
        endpoints = [
            ("GET", "/order-rows"),
            ("GET", "/stock-rows"),
            ("GET", "/parties"),
            ("GET", "/lookups"),
            ("GET", "/order-summary"),
            ("GET", "/balance-stock"),
            ("GET", "/company-order"),
            ("GET", "/company-balance"),
            ("GET", "/stats/dashboard"),
        ]
        for method, ep in endpoints:
            r = s.request(method, f"{API}{ep}")
            assert r.status_code == 200, f"{ep} => {r.status_code} {r.text[:200]}"
            # each returns JSON (list or dict)
            j = r.json()
            assert isinstance(j, (list, dict))

    def test_order_rows_unchanged(self, s):
        # sanity: real user data (>= 1 row) still present
        rows = s.get(f"{API}/order-rows").json()
        assert isinstance(rows, list)
        assert len(rows) >= 1
