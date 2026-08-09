import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

import server


GLOBAL_READONLY_ROLES = ("penerus_ilmu", "ketua_yayasan")


def run(coro):
    return asyncio.run(coro)


def actor(role):
    return {"id": f"{role}-id", "role": role}


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _limit):
        return list(self.documents)


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents
        self.find_queries = []
        self.count_queries = []

    def find(self, query=None, *_args, **_kwargs):
        self.find_queries.append(query or {})
        return FakeCursor(self.documents)

    async def count_documents(self, query):
        self.count_queries.append(query)
        return len(self.documents)


class FakeMappingDB:
    def __init__(self, collection_name, collection):
        self.collection_name = collection_name
        self.collection = collection

    def __getitem__(self, name):
        assert name == self.collection_name
        return self.collection


def route_endpoint(path, method="GET"):
    for route in server.app.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return route.endpoint
    raise AssertionError(f"Route not found: {method} {path}")


def operational_documents():
    return [
        {"_id": ObjectId(), "nama": "BRANCH_A", "cabang_id": "branch-a"},
        {"_id": ObjectId(), "nama": "BRANCH_B", "cabang_id": "branch-b"},
        {"_id": ObjectId(), "nama": "LEGACY_GLOBAL"},
    ]


class TestGlobalReadonlyOperationalReads:
    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    @pytest.mark.parametrize("entity", ["cabang", "agenda", "galeri", "pengumuman"])
    def test_generic_operational_lists_include_all_branches_and_legacy(
        self, monkeypatch, role, entity
    ):
        documents = operational_documents()
        collection = FakeCollection(documents)
        monkeypatch.setattr(server, "db", FakeMappingDB(entity, collection))

        result = run(route_endpoint(f"/api/{entity}")(actor(role)))

        assert {row["nama"] for row in result} == {
            "BRANCH_A",
            "BRANCH_B",
            "LEGACY_GLOBAL",
        }
        assert collection.find_queries == [{}]

    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    @pytest.mark.parametrize(
        ("collection_name", "list_function"),
        [
            ("jamaah", server.list_jamaah),
            ("pengurus", server.list_pengurus),
        ],
    )
    def test_lists_include_two_branches_and_legacy_records(
        self, monkeypatch, role, collection_name, list_function
    ):
        documents = operational_documents()
        collection = FakeCollection(documents)
        monkeypatch.setattr(server, "db", SimpleNamespace(**{collection_name: collection}))

        result = run(list_function(actor(role)))

        assert {row["nama"] for row in result} == {
            "BRANCH_A",
            "BRANCH_B",
            "LEGACY_GLOBAL",
        }
        assert collection.find_queries == [{}]

    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    def test_guru_list_uses_global_scope(self, monkeypatch, role):
        documents = operational_documents()
        collection = FakeCollection(documents)

        async def passthrough(docs, scope=None):
            assert scope is None
            return [server.serialize(doc) for doc in docs]

        monkeypatch.setattr(server, "db", SimpleNamespace(guru=collection))
        monkeypatch.setattr(server, "_enrich_guru", passthrough)

        result = run(server.list_guru(actor(role)))

        assert {row["nama"] for row in result} == {
            "BRANCH_A",
            "BRANCH_B",
            "LEGACY_GLOBAL",
        }
        assert collection.find_queries == [{}]

    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    def test_dashboard_returns_global_aggregation(self, monkeypatch, role):
        branch_documents = [
            {"_id": ObjectId(), "kota": "A"},
            {"_id": ObjectId(), "kota": "B"},
        ]
        agenda_documents = [{"_id": ObjectId(), "judul": "GLOBAL"}]
        fake_db = SimpleNamespace(
            cabang=FakeCollection(branch_documents),
            jamaah=FakeCollection(operational_documents()),
            guru=FakeCollection(operational_documents()),
            pengurus=FakeCollection(operational_documents()),
            agenda=FakeCollection(agenda_documents),
        )
        monkeypatch.setattr(server, "db", fake_db)

        result = run(server.dashboard_stats(actor(role)))

        assert result["total_cabang"] == 2
        assert result["total_jamaah"] == 3
        assert result["total_guru"] == 3
        assert result["total_pengurus"] == 3
        assert {row["kota"] for row in result["per_cabang"]} == {"A", "B"}

    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    def test_export_uses_unrestricted_filter(self, monkeypatch, role):
        captured = []

        async def fake_build_rows(entity, filters):
            captured.append((entity, filters))
            return [
                {"id": "a", "nama": "BRANCH_A"},
                {"id": "b", "nama": "BRANCH_B"},
                {"id": "legacy", "nama": "LEGACY_GLOBAL"},
            ]

        async def no_audit(*_args, **_kwargs):
            return None

        monkeypatch.setattr(server, "build_rows", fake_build_rows)
        monkeypatch.setattr(server, "log_action", no_audit)

        response = run(
            server.export_data(
                "jamaah",
                format="xlsx",
                cabang=None,
                cabang_id=None,
                gender=None,
                columns=None,
                user=actor(role),
            )
        )

        assert captured == [("jamaah", {})]
        assert response.media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class TestGlobalReadonlyWriteDenials:
    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    @pytest.mark.parametrize("operation", ["create", "update", "delete", "bulk_delete"])
    def test_jamaah_writes_are_forbidden_before_database_access(
        self, monkeypatch, role, operation
    ):
        monkeypatch.setattr(server, "db", object())
        user = actor(role)

        with pytest.raises(HTTPException) as exc:
            if operation == "create":
                run(server.create_jamaah({"nama": "BLOCKED"}, user))
            elif operation == "update":
                run(server.update_jamaah("000000000000000000000000", {"nama": "BLOCKED"}, user))
            elif operation == "delete":
                run(server.delete_jamaah("000000000000000000000000", user))
            else:
                run(server.bulk_delete_jamaah({"ids": ["000000000000000000000000"]}, user))

        assert exc.value.status_code == 403

    @pytest.mark.parametrize("role", GLOBAL_READONLY_ROLES)
    @pytest.mark.parametrize(
        "function,args",
        [
            (server.list_users, ()),
            (server.get_settings, ()),
            (server.audit_logs, ()),
            (server.list_messages, ()),
            (server.delete_message, ("000000000000000000000000",)),
        ],
    )
    def test_sensitive_resources_remain_super_admin_only(
        self, monkeypatch, role, function, args
    ):
        monkeypatch.setattr(server, "db", object())

        with pytest.raises(HTTPException) as exc:
            run(function(*args, actor(role)))

        assert exc.value.status_code == 403
