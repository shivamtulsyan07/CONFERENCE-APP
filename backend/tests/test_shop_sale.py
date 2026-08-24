"""Iteration 13: Shop Sale (shop-sale-rows) line-sheet CRUD tests.

Verifies:
  * shop-sale-rows collection accepts party_name + bill_no on LineRow.
  * A row with ONLY party_name + bill_no (no item/qty/remark) still persists.
  * Blank-with-id deletes; unknown sheet 404s; CRUD works end-to-end.
  * Regression: company-sent/arrived line-sheet contract also carries the new
    party_name/bill_no fields without breaking existing behaviour.
Cleans up all QA_* rows created.
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


SHEET = "shop-sale-rows"


def _cleanup_qa(s):
    rows = s.get(f"{API}/{'line-sheet'}/{SHEET}").json()
    for r in rows:
        pn = str(r.get("party_name", "") or "").upper()
        bn = str(r.get("bill_no", "") or "").upper()
        it = str(r.get("item", "") or "").upper()
        if pn.startswith("QA_") or bn.startswith("QA_") or it.startswith("QA_"):
            s.delete(f"{API}/line-sheet/{SHEET}/{r['id']}")


@pytest.fixture(autouse=True)
def _clean(s):
    _cleanup_qa(s)
    yield
    _cleanup_qa(s)


class TestShopSaleCRUD:
    def test_list_ok_and_shape(self, s):
        r = s.get(f"{API}/line-sheet/{SHEET}")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_unknown_sheet_still_404s(self, s):
        r = s.get(f"{API}/line-sheet/does-not-exist-x")
        assert r.status_code == 404

    def test_bulk_create_party_bill_roundtrip(self, s):
        payload = {"rows": [
            {"party_name": "QA_SHOP_PARTY", "bill_no": "QA_B/1",
             "group": "SH ROLL", "item": "QA_SHOP_ITEM", "shade": "S1",
             "quantity": 3, "row_index": 0}
        ]}
        r = s.post(f"{API}/line-sheet/{SHEET}/bulk", json=payload)
        assert r.status_code == 200, r.text
        saved = r.json()["saved"]
        assert len(saved) == 1
        rid = saved[0]["id"]
        assert isinstance(rid, str) and rid

        rows = s.get(f"{API}/line-sheet/{SHEET}").json()
        got = [x for x in rows if x["id"] == rid]
        assert len(got) == 1
        row = got[0]
        assert row["party_name"] == "QA_SHOP_PARTY"
        assert row["bill_no"] == "QA_B/1"
        assert row["item"] == "QA_SHOP_ITEM"
        assert row["quantity"] == 3
        assert "_id" not in row

    def test_partial_row_party_and_bill_only_persists(self, s):
        """Critical requirement: a row with only Party Name + Bill No (no
        item/qty/remark) must ALSO persist and NOT be treated as blank."""
        payload = {"rows": [
            {"party_name": "QA_PARTIAL_ONLY", "bill_no": "QA_B/PARTIAL",
             "group": "", "item": "", "shade": "", "quantity": 0}
        ]}
        r = s.post(f"{API}/line-sheet/{SHEET}/bulk", json=payload)
        assert r.status_code == 200, r.text
        saved = r.json()["saved"]
        assert len(saved) == 1
        rid = saved[0]["id"]
        # persistence
        rows = s.get(f"{API}/line-sheet/{SHEET}").json()
        got = [x for x in rows if x["id"] == rid]
        assert len(got) == 1
        assert got[0]["party_name"] == "QA_PARTIAL_ONLY"
        assert got[0]["bill_no"] == "QA_B/PARTIAL"
        assert (got[0].get("item") or "") == ""

    def test_only_party_persists(self, s):
        r = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_ONLYPARTY", "bill_no": "", "item": "",
             "shade": "", "quantity": 0}
        ]})
        assert r.status_code == 200
        assert len(r.json()["saved"]) == 1

    def test_fully_blank_row_skipped(self, s):
        r = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "", "bill_no": "", "group": "SH ROLL",
             "item": "", "shade": "", "quantity": 0, "remark": ""}
        ]})
        assert r.status_code == 200
        assert r.json()["saved"] == []

    def test_blank_with_id_deletes(self, s):
        rid = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_TODEL", "bill_no": "QA_B/DEL"}
        ]}).json()["saved"][0]["id"]
        r = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"id": rid, "party_name": "", "bill_no": "", "item": "",
             "shade": "", "quantity": 0, "remark": ""}
        ]})
        assert r.status_code == 200
        assert r.json()["saved"] == []
        assert not any(x["id"] == rid for x in s.get(f"{API}/line-sheet/{SHEET}").json())

    def test_update_by_id(self, s):
        rid = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_UPD_P", "bill_no": "QA_B/UPD",
             "item": "QA_ITEM", "shade": "S1", "quantity": 1}
        ]}).json()["saved"][0]["id"]

        r2 = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"id": rid, "party_name": "QA_UPD_P2", "bill_no": "QA_B/UPD2",
             "item": "QA_ITEM", "shade": "S9", "quantity": 7}
        ]})
        assert r2.status_code == 200
        assert r2.json()["saved"] == [{"index": 0, "id": rid}]

        row = [x for x in s.get(f"{API}/line-sheet/{SHEET}").json() if x["id"] == rid][0]
        assert row["party_name"] == "QA_UPD_P2"
        assert row["bill_no"] == "QA_B/UPD2"
        assert row["shade"] == "S9"
        assert row["quantity"] == 7

    def test_replace_wipes_and_reinserts(self, s):
        # seed one row we'll delete via replace
        s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_OLD", "bill_no": "QA_B/OLD",
             "item": "QA_OLD_ITEM", "shade": "1", "quantity": 1}
        ]})
        r = s.post(f"{API}/line-sheet/{SHEET}/replace", json={"rows": [
            {"party_name": "QA_R1", "bill_no": "QA_B/R1", "item": "QA_I", "shade": "1", "quantity": 2},
            {"party_name": "QA_R2", "bill_no": "QA_B/R2", "item": "QA_I", "shade": "2", "quantity": 4},
            {"party_name": "", "bill_no": "", "item": "", "shade": "", "quantity": 0},  # blank -> skipped
        ]})
        assert r.status_code == 200
        assert r.json()["count"] == 2
        rows = s.get(f"{API}/line-sheet/{SHEET}").json()
        # Old row must be gone
        assert not any(x.get("party_name") == "QA_OLD" for x in rows)
        assert len(rows) == 2

    def test_delete_by_id(self, s):
        rid = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_DEL_ONE", "bill_no": "QA_B/DEL1"}
        ]}).json()["saved"][0]["id"]
        r = s.delete(f"{API}/line-sheet/{SHEET}/{rid}")
        assert r.status_code == 200
        assert not any(x["id"] == rid for x in s.get(f"{API}/line-sheet/{SHEET}").json())


class TestNoRegressionOnOtherLineSheets:
    """Company-sent/arrived sheets should still work and now also carry the new
    party_name/bill_no fields on the shared LineRow schema (they may be empty)."""

    def test_company_sent_still_accepts_and_lists_with_party_bill(self, s):
        # Snapshot then wipe -> add one -> restore
        rid = s.post(f"{API}/line-sheet/company-sent-rows/bulk", json={"rows": [
            {"party_name": "QA_CS_P", "bill_no": "QA_CS_B",
             "group": "QA_G", "item": "QA_CS_ITEM", "shade": "1", "quantity": 3}
        ]}).json()["saved"][0]["id"]
        try:
            row = [x for x in s.get(f"{API}/line-sheet/company-sent-rows").json() if x["id"] == rid][0]
            # The schema now returns party_name/bill_no keys even on the other sheets.
            assert row.get("party_name") == "QA_CS_P"
            assert row.get("bill_no") == "QA_CS_B"
            assert row["item"] == "QA_CS_ITEM"
        finally:
            s.delete(f"{API}/line-sheet/company-sent-rows/{rid}")

    def test_company_balance_ignores_shop_sale(self, s):
        """A shop-sale row must NOT show up on /company-balance."""
        base = s.get(f"{API}/company-balance").json()
        rid = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_ISO", "bill_no": "QA_B/ISO",
             "group": "QA_ISO_G", "item": "QA_ISO_ITEM", "shade": "9", "quantity": 12}
        ]}).json()["saved"][0]["id"]
        try:
            d = s.get(f"{API}/company-balance").json()
            assert d["total_sent"] == base["total_sent"]
            assert d["total_arrived"] == base["total_arrived"]
            assert not any(r["item"].upper() == "QA_ISO_ITEM" for r in d["rows"])
        finally:
            s.delete(f"{API}/line-sheet/{SHEET}/{rid}")

    def test_dashboard_unaffected_by_shop_sale(self, s):
        base = s.get(f"{API}/stats/dashboard").json()
        rid = s.post(f"{API}/line-sheet/{SHEET}/bulk", json={"rows": [
            {"party_name": "QA_DASH", "bill_no": "QA_B/DASH",
             "group": "SH ROLL", "item": "QA_DASH_ITEM", "shade": "1", "quantity": 33}
        ]}).json()["saved"][0]["id"]
        try:
            now = s.get(f"{API}/stats/dashboard").json()
            # order_rows / total_qty must be unchanged; shop-sale is a separate collection.
            assert now["total_rows"] == base["total_rows"]
            assert now["total_qty"] == base["total_qty"]
            assert now["stock_qty"] == base["stock_qty"]
        finally:
            s.delete(f"{API}/line-sheet/{SHEET}/{rid}")
