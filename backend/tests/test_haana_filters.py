"""Tests for HAANA filters + assistant endpoints."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def base_overview(client):
    r = client.get(f"{API}/stats/overview")
    assert r.status_code == 200
    return r.json()


# ---- Filters ----
def test_filter_options_present(base_overview):
    fo = base_overview["filter_options"]
    for k in ["conferences", "groups", "parties", "items"]:
        assert k in fo and isinstance(fo[k], list)
    assert "applied" in base_overview
    assert base_overview["applied"] == {"conference": "", "group": "", "party": "", "item": ""}


def test_filter_by_group(client, base_overview):
    groups = base_overview["filter_options"]["groups"]
    if not groups:
        pytest.skip("no groups in data")
    g = groups[0]
    r = client.get(f"{API}/stats/overview", params={"group": g})
    assert r.status_code == 200
    d = r.json()
    assert d["applied"]["group"] == g
    assert d["kpis"]["order_rows"] <= base_overview["kpis"]["order_rows"]
    assert d["kpis"]["order_qty"] <= base_overview["kpis"]["order_qty"]


def test_filter_by_party(client, base_overview):
    parties = base_overview["filter_options"]["parties"]
    if not parties:
        pytest.skip("no parties")
    p = parties[0]
    r = client.get(f"{API}/stats/overview", params={"party": p})
    assert r.status_code == 200
    d = r.json()
    assert d["applied"]["party"] == p
    assert d["kpis"]["order_rows"] <= base_overview["kpis"]["order_rows"]
    # party_wise should contain only the filtered party (or its normalised match)
    for row in d["party_wise"]:
        assert row["party"].upper() == p.upper() or row["party"] == "—"


def test_filter_by_item(client, base_overview):
    items = base_overview["filter_options"]["items"]
    if not items:
        pytest.skip("no items")
    it = items[0]
    r = client.get(f"{API}/stats/overview", params={"item": it})
    assert r.status_code == 200
    d = r.json()
    assert d["applied"]["item"] == it
    assert d["kpis"]["order_qty"] <= base_overview["kpis"]["order_qty"]
    for row in d["item_wise"]:
        assert row["item"].upper() == it.upper()


def test_filter_combined(client, base_overview):
    parties = base_overview["filter_options"]["parties"]
    groups = base_overview["filter_options"]["groups"]
    if not parties or not groups:
        pytest.skip("no data")
    r = client.get(f"{API}/stats/overview", params={"party": parties[0], "group": groups[0]})
    assert r.status_code == 200
    d = r.json()
    assert d["applied"]["party"] == parties[0]
    assert d["applied"]["group"] == groups[0]
    assert d["kpis"]["order_rows"] <= base_overview["kpis"]["order_rows"]


def test_filter_conference(client, base_overview):
    r = client.get(f"{API}/stats/overview", params={"conference": "__NONEXISTENT__"})
    assert r.status_code == 200
    d = r.json()
    assert d["kpis"]["order_rows"] == 0


# ---- Assistant ----
def test_assistant_empty_message(client):
    r = client.post(f"{API}/assistant/ask", json={"session_id": "t-empty", "message": "   "})
    assert r.status_code == 400


def test_assistant_ask_and_history(client, base_overview):
    sid = f"test-{uuid.uuid4().hex[:8]}"
    order_rows = base_overview["kpis"]["order_rows"]

    r = requests.post(
        f"{API}/assistant/ask",
        json={"session_id": sid, "message": "How many order rows are there? Reply with just the number."},
        stream=True, timeout=60,
    )
    assert r.status_code == 200
    text = ""
    for chunk in r.iter_content(chunk_size=None):
        if chunk:
            text += chunk.decode("utf-8", errors="ignore")
    assert text.strip(), "empty stream"
    assert "*" not in text, f"markdown asterisks found: {text[:200]}"
    # answer should mention the actual row count somewhere
    assert str(order_rows) in text, f"expected {order_rows} in answer: {text[:300]}"

    # brief wait for insert
    time.sleep(1.5)
    h = client.get(f"{API}/assistant/history/{sid}").json()
    assert len(h) >= 2
    assert h[0]["role"] == "user"
    assert h[-1]["role"] == "assistant"
    assert h[-1]["text"].strip()


def test_assistant_multi_turn(client):
    sid = f"test-mt-{uuid.uuid4().hex[:8]}"
    r1 = requests.post(f"{API}/assistant/ask",
                       json={"session_id": sid, "message": "Which party has the highest order qty? Just the name."},
                       stream=True, timeout=60)
    assert r1.status_code == 200
    ans1 = "".join(c.decode("utf-8", errors="ignore") for c in r1.iter_content(chunk_size=None) if c)
    assert ans1.strip()

    time.sleep(1)
    r2 = requests.post(f"{API}/assistant/ask",
                       json={"session_id": sid, "message": "And how many rows does that party have?"},
                       stream=True, timeout=60)
    assert r2.status_code == 200
    ans2 = "".join(c.decode("utf-8", errors="ignore") for c in r2.iter_content(chunk_size=None) if c)
    assert ans2.strip()

    time.sleep(1.5)
    h = client.get(f"{API}/assistant/history/{sid}").json()
    # 2 user + 2 assistant
    assert len(h) >= 4
    roles = [m["role"] for m in h]
    assert roles.count("user") >= 2 and roles.count("assistant") >= 2
