import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://order-dispatch-hub-31.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_seed_or_present(client):
    r = client.post(f"{API}/seed")
    assert r.status_code == 200


def test_overview_shape(client):
    r = client.get(f"{API}/stats/overview")
    assert r.status_code == 200
    d = r.json()
    for k in ["kpis", "status_counts", "party_wise", "item_wise", "pending_company", "shortfalls"]:
        assert k in d, f"missing {k}"
    kp = d["kpis"]
    for k in ["order_rows", "order_qty", "order_amount", "billed_rows", "unbilled_rows",
              "parties", "stock_lines", "stock_qty", "sent_qty", "arrived_qty",
              "pending_company_qty", "pending_company_lines", "shortfall_lines", "shortfall_qty"]:
        assert k in kp, f"missing kpi {k}"


def test_overview_math(client):
    orders = client.get(f"{API}/order-rows").json()
    stock = client.get(f"{API}/stock-rows").json()
    ov = client.get(f"{API}/stats/overview").json()

    total_qty = sum((o.get("qty") or 0) for o in orders)
    assert ov["kpis"]["order_qty"] == total_qty
    assert ov["kpis"]["order_rows"] == len(orders)
    stock_qty = sum((s.get("quantity") or 0) for s in stock)
    assert ov["kpis"]["stock_qty"] == stock_qty
    assert ov["kpis"]["stock_lines"] == len(stock)

    # party_wise qty sum equals total qty (blank party mapped to "—")
    pw_qty = sum(p["qty"] for p in ov["party_wise"])
    assert pw_qty == total_qty

    # shortfalls all positive to_order, and shortfall_qty sums
    assert all(r["to_order"] > 0 for r in ov["shortfalls"])
    assert ov["kpis"]["shortfall_qty"] == sum(r["to_order"] for r in ov["shortfalls"])
    assert ov["kpis"]["shortfall_lines"] == len(ov["shortfalls"])

    # pending_company: all balance_qty > 0
    assert all(r["balance_qty"] > 0 for r in ov["pending_company"])
    assert ov["kpis"]["pending_company_qty"] == sum(r["balance_qty"] for r in ov["pending_company"])


def test_status_counts_match(client):
    orders = client.get(f"{API}/order-rows").json()
    ov = client.get(f"{API}/stats/overview").json()
    expected = {"not_ready": 0, "arrived": 0, "ready": 0}
    for o in orders:
        expected[o.get("status", "not_ready")] = expected.get(o.get("status", "not_ready"), 0) + 1
    assert ov["status_counts"] == expected


def test_regression_orders_stock_endpoints(client):
    for path in ["/order-rows", "/stock-rows", "/parties", "/lookups",
                 "/order-summary", "/balance-stock", "/company-order", "/company-balance"]:
        r = client.get(f"{API}{path}")
        assert r.status_code == 200, f"{path} => {r.status_code}"
