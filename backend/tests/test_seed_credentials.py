"""
C-02 regression tests: demo seed must never provision accounts with
hard-coded / publicly-known passwords.

Offline tests only (no network, no real database).
"""
import asyncio
import re
from pathlib import Path

import bcrypt
import pytest

from seed import demo_seed_credentials, demo_seed_enabled, seed_all

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent

LEGACY_PASSWORDS = ["Admin@2026", "Cabang@2026", "Viewer@2026"]

DEMO_PASSWORD_VARS = [
    "SEED_DEMO_ADMIN_PASSWORD",
    "SEED_DEMO_CABANG_PASSWORD",
    "SEED_DEMO_VIEWER_PASSWORD",
]


def run(coro):
    return asyncio.run(coro)


class NoDatabaseAccess:
    def __getattr__(self, name):
        raise AssertionError(f"Demo seed touched the database while it should not: {name}")


class FakeCollection:
    def __init__(self, find_one_result=None, count=0):
        self.find_one_result = find_one_result
        self.count = count
        self.inserted = []
        self.find_one_queries = []

    async def count_documents(self, _filter):
        return self.count

    async def find_one(self, query, *_args, **_kwargs):
        self.find_one_queries.append(query)
        return self.find_one_result

    async def insert_one(self, document):
        self.inserted.append(document)
        return type("Res", (), {"inserted_id": object()})()


class FakeDB:
    def __init__(self, users=None, cabang_count=0, settings_found=True):
        self.users = users or FakeCollection()
        self.cabang = FakeCollection(count=cabang_count)
        self.settings = FakeCollection(find_one_result=({} if settings_found else None))
        self.guru = FakeCollection()
        self.jamaah = FakeCollection()
        self.pengurus = FakeCollection()
        self.pengumuman = FakeCollection()
        self.agenda = FakeCollection()
        self.galeri = FakeCollection()


# ---------- Case A: no hard-coded passwords in source ----------
@pytest.mark.parametrize("legacy_password", LEGACY_PASSWORDS)
def test_a_legacy_passwords_removed_from_source(legacy_password):
    for path in (BACKEND_DIR / "seed.py", BACKEND_DIR / "tests" / "backend_test.py", ROOT_DIR / "frontend" / "src" / "pages" / "admin" / "Login.js"):
        assert legacy_password not in path.read_text()


def test_a_no_literal_password_values_in_seed_source():
    source = (BACKEND_DIR / "seed.py").read_text()
    matches = re.findall(r'"password"\s*:\s*"[^"{]+"', source)
    assert matches == [], f"Literal password values found in seed.py: {matches}"


# ---------- Case B: disabled by default, no demo users ----------
def test_b_demo_seed_disabled_by_default(monkeypatch):
    monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
    for var in DEMO_PASSWORD_VARS:
        monkeypatch.delenv(var, raising=False)

    assert demo_seed_enabled() is False
    assert run(seed_all(NoDatabaseAccess(), lambda _: "hash", lambda: "now")) is False


# ---------- Case C: enabled but credentials missing/short -> fail closed ----------
def test_c_enabled_without_credentials_never_touches_db(monkeypatch):
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    for var in DEMO_PASSWORD_VARS:
        monkeypatch.delenv(var, raising=False)

    assert demo_seed_enabled() is True
    assert demo_seed_credentials() is None
    assert run(seed_all(NoDatabaseAccess(), lambda _: "hash", lambda: "now")) is False


def test_c_short_password_is_rejected(monkeypatch):
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("SEED_DEMO_ADMIN_PASSWORD", "short")
    monkeypatch.setenv("SEED_DEMO_CABANG_PASSWORD", "anotherlongpass")
    monkeypatch.setenv("SEED_DEMO_VIEWER_PASSWORD", "yetanotherlongpass")

    assert demo_seed_credentials() is None


def test_c_credentials_resolved_when_all_present(monkeypatch):
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("SEED_DEMO_ADMIN_PASSWORD", "SuperSecretAdmin1")
    monkeypatch.setenv("SEED_DEMO_CABANG_PASSWORD", "CabangSecret123")
    monkeypatch.setenv("SEED_DEMO_VIEWER_PASSWORD", "ViewerSecret123")

    creds = demo_seed_credentials()
    assert creds is not None
    assert [u["email"] for u in creds] == [
        "admin@raudhatuljannah.id",
        "cabang@raudhatuljannah.id",
        "viewer@raudhatuljannah.id",
    ]
    assert [u["role"] for u in creds] == ["super_admin", "admin_cabang", "viewer"]


# ---------- Case D: credentials via env -> users created with bcrypt ----------
def test_d_users_created_with_bcrypt_hashed_env_passwords(monkeypatch):
    admin_pw = "SuperSecretAdmin1"
    cabang_pw = "CabangSecret123"
    viewer_pw = "ViewerSecret123"

    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("SEED_DEMO_ADMIN_PASSWORD", admin_pw)
    monkeypatch.setenv("SEED_DEMO_CABANG_PASSWORD", cabang_pw)
    monkeypatch.setenv("SEED_DEMO_VIEWER_PASSWORD", viewer_pw)

    users = FakeCollection()
    db = FakeDB(users=users, cabang_count=1, settings_found=False)
    assert run(seed_all(db, lambda p: bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"), lambda: "now")) is True

    assert len(users.inserted) == 3
    inserted_by_email = {u["email"]: u for u in users.inserted}
    assert inserted_by_email["admin@raudhatuljannah.id"]["role"] == "super_admin"
    assert inserted_by_email["cabang@raudhatuljannah.id"]["role"] == "admin_cabang"
    assert inserted_by_email["viewer@raudhatuljannah.id"]["role"] == "viewer"

    expected = {
        "admin@raudhatuljannah.id": admin_pw,
        "cabang@raudhatuljannah.id": cabang_pw,
        "viewer@raudhatuljannah.id": viewer_pw,
    }
    for email, plain in expected.items():
        doc = inserted_by_email[email]
        assert "password" not in doc
        assert bcrypt.checkpw(plain.encode("utf-8"), doc["password_hash"].encode("utf-8"))


# ---------- Case E: no password leak in logs ----------
def test_e_credentials_never_logged(caplog, monkeypatch):
    admin_pw = "SuperSecretAdmin1"
    cabang_pw = "CabangSecret123"

    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    monkeypatch.setenv("SEED_DEMO_ADMIN_PASSWORD", admin_pw)
    monkeypatch.setenv("SEED_DEMO_CABANG_PASSWORD", cabang_pw)
    monkeypatch.delenv("SEED_DEMO_VIEWER_PASSWORD", raising=False)

    with caplog.at_level("WARNING", logger="seed"):
        assert demo_seed_credentials() is None

    joined = caplog.text
    assert admin_pw not in joined
    assert cabang_pw not in joined
    assert "SEED_DEMO_VIEWER_PASSWORD" in joined
