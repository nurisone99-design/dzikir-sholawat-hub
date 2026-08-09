import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
import httpx
from bson import ObjectId

import server


CABANG_A = ObjectId("64b00000000000000000000a")
CABANG_B = ObjectId("64b00000000000000000000b")
FUTURE_DATE = "2999-01-01"


def run(coro):
    return asyncio.run(coro)


def actor(role, cabang_id=None):
    user = {"id": f"{role}-id", "role": role}
    if cabang_id is not None:
        user["cabang_id"] = str(cabang_id)
    return user


def matches(document, query):
    if not query:
        return True
    if "$or" in query and not any(matches(document, part) for part in query["$or"]):
        return False
    for key, expected in query.items():
        if key == "$or":
            continue
        actual = document.get(key)
        if isinstance(expected, dict) and "$gte" in expected:
            if actual is None or actual < expected["$gte"]:
                return False
        elif isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, key, direction):
        self.documents.sort(key=lambda row: row.get(key, ""), reverse=direction < 0)
        return self

    async def to_list(self, limit):
        return deepcopy(self.documents[:limit])


class FakeCollection:
    def __init__(self, documents):
        self.documents = deepcopy(documents)
        self.count_queries = []
        self.find_queries = []

    async def find_one(self, query, *_args, **_kwargs):
        return next((deepcopy(row) for row in self.documents if matches(row, query)), None)

    async def count_documents(self, query):
        self.count_queries.append(deepcopy(query))
        return sum(matches(row, query) for row in self.documents)

    def find(self, query=None, *_args, **_kwargs):
        query = query or {}
        self.find_queries.append(deepcopy(query))
        return FakeCursor([row for row in self.documents if matches(row, query)])


def dashboard_db():
    return SimpleNamespace(
        cabang=FakeCollection(
            [
                {"_id": CABANG_A, "kota": "CABANG_A"},
                {"_id": CABANG_B, "kota": "CABANG_B"},
            ]
        ),
        jamaah=FakeCollection(
            [
                {"_id": ObjectId(), "cabang_id": str(CABANG_A), "gender": "Laki-laki"},
                {"_id": ObjectId(), "cabang_id": str(CABANG_A), "gender": "Perempuan"},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B), "gender": "Laki-laki"},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B), "gender": "Laki-laki"},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B), "gender": "Perempuan"},
            ]
        ),
        guru=FakeCollection(
            [
                {"_id": ObjectId(), "cabang_id": str(CABANG_A)},
                {"_id": ObjectId(), "cabang_ids": [str(CABANG_A)]},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B)},
            ]
        ),
        pengurus=FakeCollection(
            [
                {"_id": ObjectId(), "cabang_id": str(CABANG_A)},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B)},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B)},
            ]
        ),
        agenda=FakeCollection(
            [
                {"_id": ObjectId(), "cabang_id": str(CABANG_A), "judul": "AGENDA_A", "tanggal": FUTURE_DATE},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B), "judul": "AGENDA_B", "tanggal": FUTURE_DATE},
            ]
        ),
        galeri=FakeCollection(
            [
                {"_id": ObjectId(), "cabang_id": str(CABANG_A), "judul": "GALERI_A"},
                {"_id": ObjectId(), "cabang_id": str(CABANG_B), "judul": "GALERI_B"},
            ]
        ),
    )


@pytest.mark.parametrize("role", ["super_admin", "penerus_ilmu", "ketua_yayasan"])
def test_global_dashboard_counts_both_branches(monkeypatch, role):
    fake_db = dashboard_db()
    monkeypatch.setattr(server, "db", fake_db)

    result = run(server.dashboard_stats(actor(role)))

    assert result["total_cabang"] == 2
    assert result["total_jamaah"] == 5
    assert result["total_guru"] == 3
    assert result["total_pengurus"] == 3
    assert result["gender"] == {"male": 3, "female": 2}
    assert {row["kota"] for row in result["per_cabang"]} == {"CABANG_A", "CABANG_B"}
    assert result["active_events"] == 2
    assert {row["judul"] for row in result["upcoming_agenda"]} == {"AGENDA_A", "AGENDA_B"}


@pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
def test_branch_dashboard_counts_only_assigned_branch(monkeypatch, role):
    fake_db = dashboard_db()
    monkeypatch.setattr(server, "db", fake_db)

    result = run(server.dashboard_stats(actor(role, CABANG_A)))

    assert result["total_cabang"] == 1
    assert result["total_jamaah"] == 2
    assert result["total_guru"] == 2
    assert result["total_pengurus"] == 1
    assert result["gender"] == {"male": 1, "female": 1}
    assert result["per_cabang"] == [{"kota": "CABANG_A", "jamaah": 2}]
    # Agenda is intentionally global-read for every official role.
    assert result["active_events"] == 2
    assert {row["judul"] for row in result["upcoming_agenda"]} == {"AGENDA_A", "AGENDA_B"}


@pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
def test_client_branch_filter_cannot_expand_dashboard_scope(monkeypatch, role):
    fake_db = dashboard_db()
    monkeypatch.setattr(server, "db", fake_db)

    # dashboard_stats has no client-controlled filter; the authenticated assignment wins.
    result = run(server.dashboard_stats(actor(role, CABANG_A)))

    assert result["total_jamaah"] == 2
    assert {str(query.get("cabang_id")) for query in fake_db.jamaah.count_queries if "cabang_id" in query} == {str(CABANG_A)}
    assert str(CABANG_B) not in str(fake_db.jamaah.count_queries)


@pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
def test_query_parameter_for_other_branch_is_ignored(monkeypatch, role):
    fake_db = dashboard_db()
    monkeypatch.setattr(server, "db", fake_db)

    async def current_user_override():
        return actor(role, CABANG_A)

    async def request_dashboard():
        server.app.dependency_overrides[server.get_current_user] = current_user_override
        try:
            transport = httpx.ASGITransport(app=server.app)
            async with httpx.AsyncClient(
                transport=transport, base_url="http://localhost"
            ) as client:
                return await client.get(
                    f"/api/dashboard/stats?cabang_id={CABANG_B}&branch={CABANG_B}"
                )
        finally:
            server.app.dependency_overrides.pop(server.get_current_user, None)

    response = run(request_dashboard())

    assert response.status_code == 200
    assert response.json()["total_jamaah"] == 2
    assert response.json()["total_guru"] == 2
    assert response.json()["total_pengurus"] == 1


def test_dashboard_uses_current_date_only_for_global_agenda(monkeypatch):
    fake_db = dashboard_db()
    monkeypatch.setattr(server, "db", fake_db)

    result = run(server.dashboard_stats(actor("viewer", CABANG_A)))

    today = datetime.now(timezone.utc).date().isoformat()
    assert fake_db.agenda.count_queries == [{"tanggal": {"$gte": today}}]
    assert result["active_events"] == 2
