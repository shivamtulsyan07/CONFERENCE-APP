"""Backend integration tests for Conference Order/Dispatch app."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://order-dispatch-hub-31.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def seeded(s):
    r = s.post(f"{API}/seed")
    assert r.status_code == 200
    return r.json()


# ---------- Seed ----------
class TestSeed:
    def test_seed_idempotent(self, s, seeded):
        # second call should say already present
        r = s.post(f"{API}/seed")
        assert r.status_code == 200
        data = r.json()
        assert data.get("seeded") is False
        assert "already" in data.get("message", "").lower()

    def test_parties_and_products_exist(self, s, seeded):
        parties = s.get(f"{API}/parties").json()
        products = s.get(f"{API}/products").json()
        assert len(parties) >= 3
        assert len(products) >= 4


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_stats(self, s, seeded):
        r = s.get(f"{API}/stats/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_orders", "total_sales", "pending_dispatch", "total_dispatches",
                  "stock_units", "products", "parties", "status_counts", "low_stock",
                  "party_wise", "daily", "recent_dispatches"]:
            assert k in d


# ---------- Parties CRUD ----------
class TestParties:
    def test_create_and_delete_party(self, s):
        payload = {"name": "TEST_Party_A", "phone": "9999999999", "city": "TestCity", "gst": "TESTGST"}
        r = s.post(f"{API}/parties", json=payload)
        assert r.status_code == 200, r.text
        party = r.json()
        assert party["name"] == payload["name"]
        assert party.get("id")
        # GET verify
        parties = s.get(f"{API}/parties").json()
        assert any(p["id"] == party["id"] for p in parties)
        # delete
        r = s.delete(f"{API}/parties/{party['id']}")
        assert r.status_code == 200
        parties = s.get(f"{API}/parties").json()
        assert not any(p["id"] == party["id"] for p in parties)


# ---------- Products CRUD + stock ----------
class TestProducts:
    def test_create_adjust_delete(self, s):
        r = s.post(f"{API}/products", json={"name": "TEST_Prod", "sku": "TP1", "unit": "pcs", "rate": 100, "shop_stock": 5})
        assert r.status_code == 200, r.text
        p = r.json()
        pid = p["id"]
        assert p["shop_stock"] == 5

        # +3
        r = s.patch(f"{API}/products/{pid}/stock", json={"delta": 3, "note": "add"})
        assert r.status_code == 200
        assert r.json()["shop_stock"] == 8
        # -2
        r = s.patch(f"{API}/products/{pid}/stock", json={"delta": -2})
        assert r.status_code == 200
        assert r.json()["shop_stock"] == 6

        r = s.delete(f"{API}/products/{pid}")
        assert r.status_code == 200


# ---------- End-to-end order->PO->receive->dispatch ----------
class TestEndToEnd:
    def test_full_flow(self, s, seeded):
        parties = s.get(f"{API}/parties").json()
        party = parties[0]

        # create dedicated product with 0 stock to test stock inc on receive
        r = s.post(f"{API}/products", json={"name": "TEST_E2E_Prod", "sku": "E2E", "unit": "pcs", "rate": 200, "shop_stock": 0})
        prod = r.json()
        pid = prod["id"]

        # empty items -> 400
        r = s.post(f"{API}/orders", json={"party_id": party["id"], "items": []})
        assert r.status_code == 400

        # create order for 10 units
        r = s.post(f"{API}/orders", json={
            "party_id": party["id"],
            "items": [{"product_id": pid, "name": prod["name"], "qty": 10, "rate": 200, "source": "company"}],
            "notes": "test"
        })
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "pending"
        assert order["total"] == 2000
        oid = order["id"]

        # create PO for 10 units linked to order
        r = s.post(f"{API}/company-orders", json={
            "supplier": "TEST_Supplier",
            "items": [{"product_id": pid, "name": prod["name"], "qty": 10}],
            "order_ids": [oid],
        })
        assert r.status_code == 200, r.text
        po = r.json()
        po_id = po["id"]

        # order status should flip to ordered_to_company
        order2 = s.get(f"{API}/orders/{oid}").json()
        assert order2["status"] == "ordered_to_company"

        # receive more than PO qty -> 400
        r = s.post(f"{API}/company-orders/{po_id}/receive", json={"items": [{"product_id": pid, "qty": 20}]})
        assert r.status_code == 400

        # partial receive 4
        r = s.post(f"{API}/company-orders/{po_id}/receive", json={"items": [{"product_id": pid, "qty": 4}]})
        assert r.status_code == 200
        assert r.json()["status"] == "partial"
        prod_after = s.get(f"{API}/products").json()
        stock = next(p["shop_stock"] for p in prod_after if p["id"] == pid)
        assert stock == 4

        # order should still be ordered_to_company (not fully received)
        order3 = s.get(f"{API}/orders/{oid}").json()
        assert order3["status"] == "ordered_to_company"

        # receive remaining 6
        r = s.post(f"{API}/company-orders/{po_id}/receive", json={"items": [{"product_id": pid, "qty": 6}]})
        assert r.status_code == 200
        assert r.json()["status"] == "received"
        # order should flip to received
        order4 = s.get(f"{API}/orders/{oid}").json()
        assert order4["status"] == "received"
        # stock 10
        stock = next(p["shop_stock"] for p in s.get(f"{API}/products").json() if p["id"] == pid)
        assert stock == 10

        # dispatch > order qty -> 400
        r = s.post(f"{API}/dispatches", json={
            "order_id": oid,
            "items": [{"product_id": pid, "name": prod["name"], "qty": 20}],
            "transport": "TestT",
        })
        assert r.status_code == 400

        # dispatch partial 6 -> stock 4
        r = s.post(f"{API}/dispatches", json={
            "order_id": oid,
            "items": [{"product_id": pid, "name": prod["name"], "qty": 6}],
            "transport": "TestT",
        })
        assert r.status_code == 200
        stock = next(p["shop_stock"] for p in s.get(f"{API}/products").json() if p["id"] == pid)
        assert stock == 4
        order5 = s.get(f"{API}/orders/{oid}").json()
        assert order5["status"] == "partial"

        # insufficient stock: try to dispatch 10 more but only 4 left
        r = s.post(f"{API}/dispatches", json={
            "order_id": oid,
            "items": [{"product_id": pid, "name": prod["name"], "qty": 4}],
            "transport": "T",
        })
        # 4 remaining pending, 4 stock -> should succeed
        assert r.status_code == 200
        order6 = s.get(f"{API}/orders/{oid}").json()
        assert order6["status"] == "dispatched"

        # cleanup
        s.delete(f"{API}/orders/{oid}")
        s.delete(f"{API}/products/{pid}")

    def test_insufficient_stock(self, s, seeded):
        parties = s.get(f"{API}/parties").json()
        party = parties[0]
        r = s.post(f"{API}/products", json={"name": "TEST_LowStock", "sku": "LS", "rate": 10, "shop_stock": 1})
        prod = r.json()
        pid = prod["id"]

        r = s.post(f"{API}/orders", json={
            "party_id": party["id"],
            "items": [{"product_id": pid, "name": prod["name"], "qty": 5, "rate": 10, "source": "shop"}],
        })
        order = r.json()
        oid = order["id"]

        r = s.post(f"{API}/dispatches", json={
            "order_id": oid,
            "items": [{"product_id": pid, "name": prod["name"], "qty": 3}],
            "transport": "T",
        })
        assert r.status_code == 400
        assert "insufficient" in r.json().get("detail", "").lower()

        s.delete(f"{API}/orders/{oid}")
        s.delete(f"{API}/products/{pid}")
