import asyncio
import io
from copy import deepcopy
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from PIL import Image

import server


CABANG_A = ObjectId()
CABANG_B = ObjectId()
READ_ROLES = (
    "super_admin",
    "penerus_ilmu",
    "ketua_yayasan",
    "admin_cabang",
    "viewer",
)
READONLY_ROLES = ("viewer", "penerus_ilmu", "ketua_yayasan")


def run(coro):
    return asyncio.run(coro)


def actor(role):
    user = {"id": f"{role}-id", "role": role}
    if role in {"admin_cabang", "viewer"}:
        user["cabang_id"] = str(CABANG_A)
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


class Phase2ADB:
    def __init__(self):
        self.cabang = FakeCollection(
            [{"_id": CABANG_A, "kota": "A"}, {"_id": CABANG_B, "kota": "B"}]
        )
        self.audit_logs = FakeAuditLogs()
        self.agenda = FakeCollection(
            [
                {"_id": ObjectId(), "judul": "AGENDA_A_MARKER", "cabang_id": str(CABANG_A)},
                {"_id": ObjectId(), "judul": "AGENDA_B_MARKER", "cabang_id": str(CABANG_B)},
                {"_id": ObjectId(), "judul": "AGENDA_LEGACY_MARKER"},
            ]
        )
        self.galeri = FakeCollection(
            [
                {"_id": ObjectId(), "judul": "GALERI_A_MARKER", "cabang_id": str(CABANG_A)},
                {"_id": ObjectId(), "judul": "GALERI_B_MARKER", "cabang_id": str(CABANG_B)},
                {"_id": ObjectId(), "judul": "GALERI_LEGACY_MARKER"},
            ]
        )

    def __getitem__(self, name):
        return getattr(self, name)


@pytest.fixture
def phase2a_db(monkeypatch):
    fake_db = Phase2ADB()
    monkeypatch.setattr(server, "db", fake_db)
    return fake_db


def item_id(collection, marker):
    return str(next(doc["_id"] for doc in collection.documents if doc["judul"] == marker))


class TestPhase2AGlobalReads:
    @pytest.mark.parametrize("role", READ_ROLES)
    @pytest.mark.parametrize(
        "entity,markers",
        [
            ("agenda", {"AGENDA_A_MARKER", "AGENDA_B_MARKER", "AGENDA_LEGACY_MARKER"}),
            ("galeri", {"GALERI_A_MARKER", "GALERI_B_MARKER", "GALERI_LEGACY_MARKER"}),
        ],
    )
    def test_all_roles_read_all_branches_and_legacy(self, phase2a_db, role, entity, markers):
        endpoint = route_endpoint(f"/api/{entity}", "GET")

        result = run(endpoint(actor(role)))

        assert {row["judul"] for row in result} == markers


class TestPhase2AAdminBranchWrites:
    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    def test_create_forces_admin_branch(self, phase2a_db, entity):
        endpoint = route_endpoint(f"/api/{entity}", "POST")

        result = run(
            endpoint(
                {"judul": f"{entity.upper()}_CREATED", "cabang_id": str(CABANG_B)},
                actor("admin_cabang"),
            )
        )

        assert result["cabang_id"] == str(CABANG_A)

    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    def test_update_own_record_succeeds_without_branch_move(self, phase2a_db, entity):
        collection = phase2a_db[entity]
        target_id = item_id(collection, f"{entity.upper()}_A_MARKER")
        endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "PUT")

        result = run(
            endpoint(
                target_id,
                {"judul": f"{entity.upper()}_A_UPDATED", "cabang_id": str(CABANG_B)},
                actor("admin_cabang"),
            )
        )

        assert result["judul"] == f"{entity.upper()}_A_UPDATED"
        assert result["cabang_id"] == str(CABANG_A)

    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    @pytest.mark.parametrize("operation", ["update", "delete"])
    def test_other_branch_mutation_returns_404(self, phase2a_db, entity, operation):
        collection = phase2a_db[entity]
        target_id = item_id(collection, f"{entity.upper()}_B_MARKER")

        with pytest.raises(HTTPException) as exc:
            if operation == "update":
                endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "PUT")
                run(endpoint(target_id, {"judul": "BLOCKED"}, actor("admin_cabang")))
            else:
                endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "DELETE")
                run(endpoint(target_id, actor("admin_cabang")))

        assert exc.value.status_code == 404

    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    def test_delete_own_record_succeeds(self, phase2a_db, entity):
        collection = phase2a_db[entity]
        target_id = item_id(collection, f"{entity.upper()}_A_MARKER")
        endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "DELETE")

        result = run(endpoint(target_id, actor("admin_cabang")))

        assert result["message"] == "Data dihapus"

    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    def test_legacy_record_is_not_mutable_by_admin_cabang(self, phase2a_db, entity):
        collection = phase2a_db[entity]
        target_id = item_id(collection, f"{entity.upper()}_LEGACY_MARKER")
        endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "PUT")

        with pytest.raises(HTTPException) as exc:
            run(endpoint(target_id, {"judul": "BLOCKED"}, actor("admin_cabang")))

        assert exc.value.status_code == 404


class TestPhase2ABulkAtomicity:
    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    def test_own_branch_bulk_delete_succeeds(self, phase2a_db, entity):
        collection = phase2a_db[entity]
        own_id = item_id(collection, f"{entity.upper()}_A_MARKER")
        endpoint = route_endpoint(f"/api/{entity}/bulk-delete", "POST")

        result = run(endpoint({"ids": [own_id]}, actor("admin_cabang")))

        assert result["message"] == "1 data dihapus"
        assert all(str(doc["_id"]) != own_id for doc in collection.documents)

    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    @pytest.mark.parametrize("selection", ["other", "mixed"])
    def test_cross_branch_bulk_delete_fails_without_partial_deletion(
        self, phase2a_db, entity, selection
    ):
        collection = phase2a_db[entity]
        own_id = item_id(collection, f"{entity.upper()}_A_MARKER")
        other_id = item_id(collection, f"{entity.upper()}_B_MARKER")
        ids = [other_id] if selection == "other" else [own_id, other_id]
        before = deepcopy(collection.documents)
        endpoint = route_endpoint(f"/api/{entity}/bulk-delete", "POST")

        with pytest.raises(HTTPException) as exc:
            run(endpoint({"ids": ids}, actor("admin_cabang")))

        assert exc.value.status_code == 404
        assert collection.documents == before
        assert collection.delete_many_calls == 0


class TestPhase2AReadonlyWriteDenials:
    @pytest.mark.parametrize("role", READONLY_ROLES)
    @pytest.mark.parametrize("entity", ["agenda", "galeri"])
    @pytest.mark.parametrize("operation", ["create", "update", "delete", "bulk_delete"])
    def test_all_mutations_return_403(self, phase2a_db, role, entity, operation):
        collection = phase2a_db[entity]
        target_id = item_id(collection, f"{entity.upper()}_A_MARKER")

        with pytest.raises(HTTPException) as exc:
            if operation == "create":
                endpoint = route_endpoint(f"/api/{entity}", "POST")
                run(endpoint({"judul": "BLOCKED"}, actor(role)))
            elif operation == "update":
                endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "PUT")
                run(endpoint(target_id, {"judul": "BLOCKED"}, actor(role)))
            elif operation == "delete":
                endpoint = route_endpoint(f"/api/{entity}/{{item_id}}", "DELETE")
                run(endpoint(target_id, actor(role)))
            else:
                endpoint = route_endpoint(f"/api/{entity}/bulk-delete", "POST")
                run(endpoint({"ids": [target_id]}, actor(role)))

        assert exc.value.status_code == 403


class UploadProbe:
    content_type = "image/png"

    def __init__(self, content):
        self.content = content
        self.read_called = False

    async def read(self):
        self.read_called = True
        return self.content


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (2, 2), color="white").save(output, format="PNG")
    return output.getvalue()


class TestPhase2AGalleryUpload:
    def test_admin_a_can_upload_gallery_file(self, phase2a_db, monkeypatch, tmp_path):
        upload = UploadProbe(png_bytes())
        monkeypatch.setattr(server, "UPLOAD_DIR", tmp_path)

        result = run(server.upload_file("galeri", upload, actor("admin_cabang")))

        assert upload.read_called is True
        assert result["url"].startswith("/uploads/galeri/")
        assert len(list((tmp_path / "galeri").glob("*.webp"))) == 1

    @pytest.mark.parametrize("role", READONLY_ROLES)
    def test_readonly_roles_cannot_upload_gallery_file(
        self, phase2a_db, monkeypatch, tmp_path, role
    ):
        upload = UploadProbe(png_bytes())
        monkeypatch.setattr(server, "UPLOAD_DIR", tmp_path)

        with pytest.raises(HTTPException) as exc:
            run(server.upload_file("galeri", upload, actor(role)))

        assert exc.value.status_code == 403
        assert upload.read_called is False
        assert list(tmp_path.rglob("*")) == []
