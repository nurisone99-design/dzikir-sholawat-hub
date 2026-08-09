import asyncio
import io

import pytest
from bson import ObjectId
from fastapi import HTTPException
from PIL import Image
from starlette.requests import Request

import server


def run(coro):
    return asyncio.run(coro)


def request_for(path: str = "/api/auth/login") -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": path,
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "app": server.app,
        }
    )


class FakeUsers:
    def __init__(self, user):
        self.user = user

    async def find_one(self, *_args, **_kwargs):
        return self.user


class FakeAuditLogs:
    def __init__(self):
        self.inserted = []

    async def insert_one(self, document):
        self.inserted.append(document)


class FakeCabang:
    def __init__(self, existing_id=None):
        self.existing_id = existing_id
        self.queries = []

    async def find_one(self, query, *_args, **_kwargs):
        self.queries.append(query)
        if self.existing_id is not None and query.get("_id") == self.existing_id:
            return {"_id": self.existing_id}
        return None


class FakeDB:
    def __init__(self, user=None, branch_id=None):
        self.users = FakeUsers(user)
        self.audit_logs = FakeAuditLogs()
        self.cabang = FakeCabang(branch_id)


class NoReadUpload:
    content_type = "image/png"

    def __init__(self, content=b"not-an-image"):
        self.content = content
        self.read_called = False

    async def read(self):
        self.read_called = True
        return self.content


def png_bytes():
    output = io.BytesIO()
    Image.new("RGB", (2, 2), color="white").save(output, format="PNG")
    return output.getvalue()


def database_user(role_marker, cabang_id=None):
    user = {
        "_id": ObjectId(),
        "username": f"test-{role_marker or 'missing'}",
        "email": f"{role_marker or 'missing'}@example.test",
        "password_hash": server.hash_password("ValidPass@123"),
        "status": "active",
    }
    if role_marker is not None:
        user["role"] = role_marker
    if cabang_id is not None:
        user["cabang_id"] = str(cabang_id)
    return user


class TestAuthenticationHardening:
    @pytest.mark.parametrize(
        "role",
        ["super_admin", "admin_cabang", "viewer", "penerus_ilmu", "ketua_yayasan"],
    )
    def test_official_database_roles_can_login(self, monkeypatch, role):
        branch_id = ObjectId() if role in {"admin_cabang", "viewer"} else None
        user = database_user(role, branch_id)
        fake_db = FakeDB(user=user)
        monkeypatch.setattr(server, "db", fake_db)

        result = run(
            server.login.__wrapped__(
                request_for(),
                server.LoginInput(email=user["email"], password="ValidPass@123"),
            )
        )

        assert result["token"]
        assert result["user"]["role"] == role
        assert len(fake_db.audit_logs.inserted) == 1
        assert fake_db.audit_logs.inserted[0]["action"] == "LOGIN"

    @pytest.mark.parametrize("role_marker", ["unknown", "", None])
    def test_unknown_missing_and_empty_roles_cannot_login_or_create_session_artifacts(
        self, monkeypatch, role_marker
    ):
        user = database_user(role_marker)
        fake_db = FakeDB(user=user)
        token_calls = []
        monkeypatch.setattr(server, "db", fake_db)
        monkeypatch.setattr(
            server,
            "create_access_token",
            lambda *_args, **_kwargs: token_calls.append(True) or "unexpected-token",
        )

        with pytest.raises(HTTPException) as exc:
            run(
                server.login.__wrapped__(
                    request_for(),
                    server.LoginInput(email=user["email"], password="ValidPass@123"),
                )
            )

        assert exc.value.status_code == 403
        assert token_calls == []
        assert fake_db.audit_logs.inserted == []


class TestUserManagementHardening:
    @pytest.mark.parametrize(
        "role", ["admin_cabang", "viewer", "penerus_ilmu", "ketua_yayasan"]
    )
    @pytest.mark.parametrize("operation", ["create", "update", "delete"])
    def test_non_super_roles_cannot_mutate_users(self, role, operation):
        actor = {"id": "actor-id", "role": role, "cabang_id": "branch-id"}

        with pytest.raises(HTTPException) as exc:
            if operation == "create":
                run(
                    server.create_user(
                        server.UserCreate(
                            username="blocked",
                            email="blocked@example.com",
                            password="ValidPass@123",
                            role="viewer",
                        ),
                        actor,
                    )
                )
            elif operation == "update":
                run(server.update_user("000000000000000000000000", server.UserUpdate(name="blocked"), actor))
            else:
                run(server.delete_user("000000000000000000000000", actor))

        assert exc.value.status_code == 403

    def test_invalid_role_is_rejected_before_create_database_access(self, monkeypatch):
        monkeypatch.setattr(server, "db", object())

        with pytest.raises(HTTPException) as exc:
            run(
                server.create_user(
                    server.UserCreate(
                        username="invalid",
                        email="invalid@example.com",
                        password="ValidPass@123",
                        role="unknown",
                    ),
                    {"id": "super-id", "role": "super_admin"},
                )
            )

        assert exc.value.status_code == 403

    def test_invalid_role_is_rejected_before_update_database_access(self, monkeypatch):
        monkeypatch.setattr(server, "db", object())

        with pytest.raises(HTTPException) as exc:
            run(
                server.update_user(
                    "000000000000000000000000",
                    server.UserUpdate(role="unknown"),
                    {"id": "super-id", "role": "super_admin"},
                )
            )

        assert exc.value.status_code == 403


class TestUploadHardening:
    @pytest.mark.parametrize(
        "user",
        [
            {"role": "viewer", "cabang_id": str(ObjectId())},
            {"role": "penerus_ilmu"},
            {"role": "ketua_yayasan"},
            {"role": "unknown", "cabang_id": str(ObjectId())},
            {"role": "admin_cabang"},
        ],
    )
    def test_rejected_uploads_do_not_read_or_write_files(self, monkeypatch, tmp_path, user):
        upload = NoReadUpload()
        monkeypatch.setattr(server, "UPLOAD_DIR", tmp_path)
        monkeypatch.setattr(server, "db", FakeDB())

        with pytest.raises(HTTPException) as exc:
            run(server.upload_file("jamaah", upload, user))

        assert exc.value.status_code == 403
        assert upload.read_called is False
        assert list(tmp_path.rglob("*")) == []

    def test_admin_cabang_with_existing_assignment_can_upload(self, monkeypatch, tmp_path):
        branch_id = ObjectId()
        upload = NoReadUpload(png_bytes())
        fake_db = FakeDB(branch_id=branch_id)
        monkeypatch.setattr(server, "UPLOAD_DIR", tmp_path)
        monkeypatch.setattr(server, "db", fake_db)

        result = run(
            server.upload_file(
                "jamaah",
                upload,
                {"role": "admin_cabang", "cabang_id": str(branch_id)},
            )
        )

        assert upload.read_called is True
        assert result["url"].startswith("/uploads/jamaah/")
        assert len(list((tmp_path / "jamaah").glob("*.webp"))) == 1
        assert fake_db.cabang.queries == [{"_id": branch_id}]

    def test_super_admin_can_upload_without_branch_assignment(self, monkeypatch, tmp_path):
        upload = NoReadUpload(png_bytes())
        fake_db = FakeDB()
        monkeypatch.setattr(server, "UPLOAD_DIR", tmp_path)
        monkeypatch.setattr(server, "db", fake_db)

        result = run(server.upload_file("jamaah", upload, {"role": "super_admin"}))

        assert upload.read_called is True
        assert result["url"].startswith("/uploads/jamaah/")
        assert len(list((tmp_path / "jamaah").glob("*.webp"))) == 1
        assert fake_db.cabang.queries == []
