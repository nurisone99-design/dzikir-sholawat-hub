import asyncio
from copy import deepcopy
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

import server


CABANG_A = ObjectId()
CABANG_B = ObjectId()
READONLY_ROLES = ("viewer", "penerus_ilmu", "ketua_yayasan")


def run(coro):
    return asyncio.run(coro)


def actor(role, cabang_id=CABANG_A):
    user = {"id": f"{role}-id", "role": role}
    if role in {"admin_cabang", "viewer"}:
        user["cabang_id"] = str(cabang_id)
    return user


def route_endpoint(path, method):
    for route in server.app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route.endpoint
    raise AssertionError(f"Route not found: {method} {path}")


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _limit):
        return deepcopy(self.documents)


class WriteResult:
    def __init__(self, matched=0, deleted=0):
        self.matched_count = matched
        self.deleted_count = deleted


def matches(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict) and "$in" in expected:
            if actual not in expected["$in"]:
                return False
        elif actual != expected:
            return False
    return True


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = deepcopy(list(documents))
        self.delete_many_calls = 0

    def find(self, query=None, *_args, **_kwargs):
        query = query or {}
        return FakeCursor([doc for doc in self.documents if matches(doc, query)])

    async def find_one(self, query, *_args, **_kwargs):
        return next((deepcopy(doc) for doc in self.documents if matches(doc, query)), None)

    async def insert_one(self, document):
        stored = deepcopy(document)
        stored["_id"] = ObjectId()
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    async def update_one(self, query, update):
        for document in self.documents:
            if matches(document, query):
                document.update(deepcopy(update["$set"]))
                return WriteResult(matched=1)
        return WriteResult()

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if matches(document, query):
                self.documents.pop(index)
                return WriteResult(deleted=1)
        return WriteResult()

    async def count_documents(self, query):
        return sum(1 for document in self.documents if matches(document, query))

    async def delete_many(self, query):
        self.delete_many_calls += 1
        before = len(self.documents)
        self.documents = [doc for doc in self.documents if not matches(doc, query)]
        return WriteResult(deleted=before - len(self.documents))


class FakeAuditLogs:
    async def insert_one(self, _document):
        return None


class BranchScopeDB:
    def __init__(self):
        self.cabang = FakeCollection(
            [
                {"_id": CABANG_A, "kota": "A"},
                {"_id": CABANG_B, "kota": "B"},
            ]
        )
        self.guru = FakeCollection([])
        self.audit_logs = FakeAuditLogs()
        self.pengumuman = FakeCollection(
            [
                {"_id": ObjectId(), "judul": "PENG_A_MARKER", "cabang_id": str(CABANG_A)},
                {"_id": ObjectId(), "judul": "PENG_B_MARKER", "cabang_id": str(CABANG_B)},
                {"_id": ObjectId(), "judul": "PENG_LEGACY_MARKER"},
            ]
        )

    def __getitem__(self, name):
        return getattr(self, name)


@pytest.fixture
def branch_scope_db(monkeypatch):
    fake_db = BranchScopeDB()
    monkeypatch.setattr(server, "db", fake_db)
    return fake_db


def item_id(collection, marker):
    return str(next(doc["_id"] for doc in collection.documents if doc["judul"] == marker))


class TestCabangReadScoping:
    @pytest.mark.parametrize("role", ["super_admin", "penerus_ilmu", "ketua_yayasan"])
    def test_global_roles_read_all_cabang(self, branch_scope_db, role):
        endpoint = route_endpoint("/api/cabang", "GET")

        result = run(endpoint(actor(role)))

        assert {row["kota"] for row in result} == {"A", "B"}

    @pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
    def test_branch_scoped_roles_read_only_own_cabang(self, branch_scope_db, role):
        endpoint = route_endpoint("/api/cabang", "GET")

        result = run(endpoint(actor(role, CABANG_A)))

        assert [row["kota"] for row in result] == ["A"]

    @pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
    def test_get_other_branch_cabang_returns_404(self, branch_scope_db, role):
        endpoint = route_endpoint("/api/cabang/{item_id}", "GET")

        with pytest.raises(HTTPException) as exc:
            run(endpoint(str(CABANG_B), actor(role, CABANG_A)))

        assert exc.value.status_code == 404

    @pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
    def test_get_own_cabang_succeeds(self, branch_scope_db, role):
        endpoint = route_endpoint("/api/cabang/{item_id}", "GET")

        result = run(endpoint(str(CABANG_A), actor(role, CABANG_A)))

        assert result["kota"] == "A"


class TestCabangWriteRequiresSuperAdmin:
    @pytest.mark.parametrize("role", READONLY_ROLES)
    @pytest.mark.parametrize("operation", ["create", "update", "delete", "bulk_delete"])
    def test_non_super_mutations_return_403(self, branch_scope_db, role, operation):
        with pytest.raises(HTTPException) as exc:
            if operation == "create":
                endpoint = route_endpoint("/api/cabang", "POST")
                run(endpoint({"kota": "C"}, actor(role)))
            elif operation == "update":
                endpoint = route_endpoint("/api/cabang/{item_id}", "PUT")
                run(endpoint(str(CABANG_A), {"kota": "A2"}, actor(role)))
            elif operation == "delete":
                endpoint = route_endpoint("/api/cabang/{item_id}", "DELETE")
                run(endpoint(str(CABANG_A), actor(role)))
            else:
                endpoint = route_endpoint("/api/cabang/bulk-delete", "POST")
                run(endpoint({"ids": [str(CABANG_A)]}, actor(role)))

        assert exc.value.status_code == 403

    @pytest.mark.parametrize("operation", ["create", "update", "delete", "bulk_delete"])
    def test_admin_cabang_cannot_write_cabang(self, branch_scope_db, operation):
        user = actor("admin_cabang", CABANG_A)

        with pytest.raises(HTTPException) as exc:
            if operation == "create":
                endpoint = route_endpoint("/api/cabang", "POST")
                run(endpoint({"kota": "C"}, user))
            elif operation == "update":
                endpoint = route_endpoint("/api/cabang/{item_id}", "PUT")
                run(endpoint(str(CABANG_A), {"kota": "A2"}, user))
            elif operation == "delete":
                endpoint = route_endpoint("/api/cabang/{item_id}", "DELETE")
                run(endpoint(str(CABANG_A), user))
            else:
                endpoint = route_endpoint("/api/cabang/bulk-delete", "POST")
                run(endpoint({"ids": [str(CABANG_A)]}, user))

        assert exc.value.status_code == 403

    def test_super_admin_can_create_cabang(self, branch_scope_db):
        endpoint = route_endpoint("/api/cabang", "POST")

        result = run(endpoint({"kota": "C"}, actor("super_admin")))

        assert result["kota"] == "C"

    def test_super_admin_can_update_cabang(self, branch_scope_db):
        endpoint = route_endpoint("/api/cabang/{item_id}", "PUT")

        result = run(endpoint(str(CABANG_A), {"kota": "A2"}, actor("super_admin")))

        assert result["kota"] == "A2"

    def test_super_admin_can_delete_cabang(self, branch_scope_db):
        endpoint = route_endpoint("/api/cabang/{item_id}", "DELETE")

        result = run(endpoint(str(CABANG_A), actor("super_admin")))

        assert result["message"] == "Data dihapus"
        assert all(str(doc["_id"]) != str(CABANG_A) for doc in branch_scope_db.cabang.documents)


class TestPengumumanReads:
    @pytest.mark.parametrize("role", ["super_admin", "penerus_ilmu", "ketua_yayasan", "admin_cabang", "viewer"])
    def test_all_roles_read_all_pengumuman(self, branch_scope_db, role):
        endpoint = route_endpoint("/api/pengumuman", "GET")

        result = run(endpoint(actor(role, CABANG_A)))

        assert {row["judul"] for row in result} == {
            "PENG_A_MARKER",
            "PENG_B_MARKER",
            "PENG_LEGACY_MARKER",
        }


class TestPengumumanBranchWrites:
    def test_admin_cabang_create_forces_own_branch(self, branch_scope_db):
        endpoint = route_endpoint("/api/pengumuman", "POST")

        result = run(
            endpoint(
                {"judul": "PENG_CREATED", "cabang_id": str(CABANG_B)},
                actor("admin_cabang", CABANG_A),
            )
        )

        assert result["judul"] == "PENG_CREATED"
        assert result["cabang_id"] == str(CABANG_A)

    def test_admin_cabang_update_own_record_succeeds(self, branch_scope_db):
        collection = branch_scope_db.pengumuman
        target_id = item_id(collection, "PENG_A_MARKER")
        endpoint = route_endpoint("/api/pengumuman/{item_id}", "PUT")

        result = run(
            endpoint(
                target_id,
                {"judul": "PENG_A_UPDATED", "cabang_id": str(CABANG_B)},
                actor("admin_cabang", CABANG_A),
            )
        )

        assert result["judul"] == "PENG_A_UPDATED"
        assert result["cabang_id"] == str(CABANG_A)

    @pytest.mark.parametrize("operation", ["update", "delete"])
    def test_other_branch_pengumuman_mutation_returns_404(self, branch_scope_db, operation):
        collection = branch_scope_db.pengumuman
        target_id = item_id(collection, "PENG_B_MARKER")

        with pytest.raises(HTTPException) as exc:
            if operation == "update":
                endpoint = route_endpoint("/api/pengumuman/{item_id}", "PUT")
                run(endpoint(target_id, {"judul": "BLOCKED"}, actor("admin_cabang", CABANG_A)))
            else:
                endpoint = route_endpoint("/api/pengumuman/{item_id}", "DELETE")
                run(endpoint(target_id, actor("admin_cabang", CABANG_A)))

        assert exc.value.status_code == 404

    def test_admin_cabang_delete_own_record_succeeds(self, branch_scope_db):
        collection = branch_scope_db.pengumuman
        target_id = item_id(collection, "PENG_A_MARKER")
        endpoint = route_endpoint("/api/pengumuman/{item_id}", "DELETE")

        result = run(endpoint(target_id, actor("admin_cabang", CABANG_A)))

        assert result["message"] == "Data dihapus"
        assert all(str(doc["_id"]) != target_id for doc in collection.documents)

    def test_legacy_pengumuman_not_mutable_by_admin_cabang(self, branch_scope_db):
        collection = branch_scope_db.pengumuman
        target_id = item_id(collection, "PENG_LEGACY_MARKER")
        endpoint = route_endpoint("/api/pengumuman/{item_id}", "PUT")

        with pytest.raises(HTTPException) as exc:
            run(endpoint(target_id, {"judul": "BLOCKED"}, actor("admin_cabang", CABANG_A)))

        assert exc.value.status_code == 404

    def test_cross_branch_bulk_delete_fails_without_partial_deletion(self, branch_scope_db):
        collection = branch_scope_db.pengumuman
        own_id = item_id(collection, "PENG_A_MARKER")
        other_id = item_id(collection, "PENG_B_MARKER")
        before = deepcopy(collection.documents)
        endpoint = route_endpoint("/api/pengumuman/bulk-delete", "POST")

        with pytest.raises(HTTPException) as exc:
            run(endpoint({"ids": [own_id, other_id]}, actor("admin_cabang", CABANG_A)))

        assert exc.value.status_code == 404
        assert collection.documents == before
        assert collection.delete_many_calls == 0


class TestPengumumanReadonlyWriteDenials:
    @pytest.mark.parametrize("role", READONLY_ROLES)
    @pytest.mark.parametrize("operation", ["create", "update", "delete", "bulk_delete"])
    def test_all_mutations_return_403(self, branch_scope_db, role, operation):
        collection = branch_scope_db.pengumuman
        target_id = item_id(collection, "PENG_A_MARKER")

        with pytest.raises(HTTPException) as exc:
            if operation == "create":
                endpoint = route_endpoint("/api/pengumuman", "POST")
                run(endpoint({"judul": "BLOCKED"}, actor(role)))
            elif operation == "update":
                endpoint = route_endpoint("/api/pengumuman/{item_id}", "PUT")
                run(endpoint(target_id, {"judul": "BLOCKED"}, actor(role)))
            elif operation == "delete":
                endpoint = route_endpoint("/api/pengumuman/{item_id}", "DELETE")
                run(endpoint(target_id, actor(role)))
            else:
                endpoint = route_endpoint("/api/pengumuman/bulk-delete", "POST")
                run(endpoint({"ids": [target_id]}, actor(role)))

        assert exc.value.status_code == 403
