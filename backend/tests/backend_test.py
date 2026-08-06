"""
Backend API tests for Yayasan Raudhatul Jannah Admin Portal
Covers: auth, RBAC, CRUD, dashboard, exports, backup, public endpoints.
"""
import os
import io
import asyncio
import sys
from pathlib import Path
import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from seed import demo_seed_enabled, seed_all

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dzikir-sholawat-hub.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

SUPER = {"email": "admin@raudhatuljannah.id", "password": "Admin@2026"}
CABANG_USER = {"email": "cabang@raudhatuljannah.id", "password": "Cabang@2026"}
VIEWER = {"email": "viewer@raudhatuljannah.id", "password": "Viewer@2026"}


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def super_token():
    r = requests.post(f"{API}/auth/login", json=SUPER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def viewer_token():
    r = requests.post(f"{API}/auth/login", json=VIEWER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def cabang_token():
    r = requests.post(f"{API}/auth/login", json=CABANG_USER, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def H(t): return {"Authorization": f"Bearer {t}"}


# ---------- Seed configuration ----------
class NoDatabaseAccess:
    def __getattr__(self, name):
        raise AssertionError(f"Demo seed accessed database while disabled: {name}")


def test_demo_seed_is_disabled_by_default_and_does_not_create_demo_accounts(monkeypatch):
    monkeypatch.delenv("SEED_DEMO_DATA", raising=False)

    assert demo_seed_enabled() is False
    assert asyncio.run(seed_all(NoDatabaseAccess(), lambda _: "hash", lambda: "now")) is False


# ---------- Public ----------
class TestPublic:
    def test_stats(self):
        r = requests.get(f"{API}/public/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_cabang", "total_guru", "total_jamaah", "total_agenda"]:
            assert k in d and isinstance(d[k], int)
        assert d["total_cabang"] >= 5

    def test_cabang(self):
        r = requests.get(f"{API}/public/cabang", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 5

    def test_agenda(self):
        r = requests.get(f"{API}/public/agenda", timeout=15)
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_pengumuman(self):
        r = requests.get(f"{API}/public/pengumuman", timeout=15)
        assert r.status_code == 200

    def test_galeri(self):
        r = requests.get(f"{API}/public/galeri", timeout=15)
        assert r.status_code == 200

    def test_settings(self):
        r = requests.get(f"{API}/public/settings", timeout=15)
        assert r.status_code == 200
        data = r.json()
        sensitive_fields = {
            "wa_api_key",
            "password",
            "password_hash",
            "secret",
            "api_key",
            "token",
        }
        assert sensitive_fields.isdisjoint(data)

    def test_contact_submit(self):
        r = requests.post(f"{API}/public/contact",
                          json={"nama": "TEST_visitor", "whatsapp": "+628123456789",
                                "pesan": "Halo, ini pesan tes."}, timeout=15)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- Auth ----------
class TestAuth:
    def test_login_success_email(self):
        r = requests.post(f"{API}/auth/login", json=SUPER, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and len(d["token"]) > 20
        assert d["user"]["role"] == "super_admin"
        assert "password_hash" not in d["user"]

    def test_login_by_username(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "superadmin", "password": "Admin@2026"}, timeout=15)
        assert r.status_code == 200

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": SUPER["email"], "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me(self, super_token):
        r = requests.get(f"{API}/auth/me", headers=H(super_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == SUPER["email"]

    def test_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401


# ---------- RBAC ----------
class TestRBAC:
    def test_viewer_cannot_create(self, viewer_token):
        r = requests.post(f"{API}/cabang", json={"kota": "TEST_x", "alamat": "x"},
                          headers=H(viewer_token), timeout=15)
        assert r.status_code == 403

    def test_viewer_can_read(self, viewer_token):
        r = requests.get(f"{API}/cabang", headers=H(viewer_token), timeout=15)
        assert r.status_code == 200

    def test_non_super_cannot_create_user(self, cabang_token):
        r = requests.post(f"{API}/users",
                          json={"username": "TEST_u", "email": "TEST_u@x.com",
                                "password": "pw123", "role": "viewer"},
                          headers=H(cabang_token), timeout=15)
        assert r.status_code == 403

    def test_non_super_cannot_backup(self, cabang_token):
        r = requests.get(f"{API}/backup", headers=H(cabang_token), timeout=15)
        assert r.status_code == 403


# ---------- CRUD Cabang ----------
class TestCabangCRUD:
    created_id = None

    def test_create(self, super_token):
        payload = {"kota": "TEST_Kota", "alamat": "Jl. Test 1", "ketua": "Tester",
                   "no_hp": "0812", "lat": -6.2, "lng": 106.8}
        r = requests.post(f"{API}/cabang", json=payload, headers=H(super_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kota"] == "TEST_Kota"
        assert "id" in d
        TestCabangCRUD.created_id = d["id"]

    def test_get_persisted(self, super_token):
        r = requests.get(f"{API}/cabang/{TestCabangCRUD.created_id}",
                         headers=H(super_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["kota"] == "TEST_Kota"

    def test_update(self, super_token):
        r = requests.put(f"{API}/cabang/{TestCabangCRUD.created_id}",
                         json={"kota": "TEST_Kota_Updated"},
                         headers=H(super_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["kota"] == "TEST_Kota_Updated"

    def test_delete(self, super_token):
        r = requests.delete(f"{API}/cabang/{TestCabangCRUD.created_id}",
                            headers=H(super_token), timeout=15)
        assert r.status_code == 200
        # verify gone
        r2 = requests.get(f"{API}/cabang/{TestCabangCRUD.created_id}",
                          headers=H(super_token), timeout=15)
        assert r2.status_code == 404


# ---------- CRUD Jamaah with ijazah tags ----------
class TestJamaahCRUD:
    def test_create_with_tags(self, super_token):
        # get a cabang id
        cab = requests.get(f"{API}/cabang", headers=H(super_token), timeout=15).json()
        cabang_id = cab[0]["id"]
        payload = {"nama": "TEST_Jamaah", "nik": "1234", "gender": "Laki-laki",
                   "cabang_id": cabang_id, "ijazah": ["Kitab", "Amaliah"]}
        r = requests.post(f"{API}/jamaah", json=payload, headers=H(super_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["ijazah"] == ["Kitab", "Amaliah"]
        # cleanup
        requests.delete(f"{API}/jamaah/{d['id']}", headers=H(super_token), timeout=15)


# ---------- Dashboard ----------
class TestDashboard:
    def test_stats(self, super_token):
        r = requests.get(f"{API}/dashboard/stats", headers=H(super_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_cabang", "total_guru", "total_jamaah", "active_events",
                  "per_cabang", "gender", "upcoming_agenda"]:
            assert k in d
        assert isinstance(d["per_cabang"], list)
        assert "male" in d["gender"] and "female" in d["gender"]


# ---------- Exports ----------
class TestExports:
    @pytest.mark.parametrize("entity", ["cabang", "jamaah", "guru", "pengurus", "agenda"])
    def test_xlsx(self, super_token, entity):
        r = requests.get(f"{API}/export/{entity}?format=xlsx",
                         headers=H(super_token), timeout=30)
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert len(r.content) > 100

    def test_pdf(self, super_token):
        r = requests.get(f"{API}/export/jamaah?format=pdf",
                         headers=H(super_token), timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_export_filter(self, super_token):
        r = requests.get(f"{API}/export/jamaah?format=xlsx&gender=Laki-laki",
                         headers=H(super_token), timeout=30)
        assert r.status_code == 200


# ---------- Users ----------
class TestUsers:
    uid = None

    def test_list(self, super_token):
        r = requests.get(f"{API}/users", headers=H(super_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create(self, super_token):
        r = requests.post(f"{API}/users",
                          json={"username": "TEST_userx", "email": "TEST_userx@example.com",
                                "password": "Pass@123", "role": "viewer", "name": "TU"},
                          headers=H(super_token), timeout=15)
        assert r.status_code == 200, r.text
        TestUsers.uid = r.json()["id"]

    def test_update(self, super_token):
        r = requests.put(f"{API}/users/{TestUsers.uid}",
                         json={"name": "TU Updated"},
                         headers=H(super_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TU Updated"

    def test_cannot_delete_self(self, super_token):
        me = requests.get(f"{API}/auth/me", headers=H(super_token), timeout=15).json()
        r = requests.delete(f"{API}/users/{me['id']}", headers=H(super_token), timeout=15)
        assert r.status_code == 400

    def test_delete(self, super_token):
        r = requests.delete(f"{API}/users/{TestUsers.uid}",
                            headers=H(super_token), timeout=15)
        assert r.status_code == 200


# ---------- Settings & Backup ----------
class TestSettingsBackup:
    def test_get_settings(self, super_token):
        r = requests.get(f"{API}/settings", headers=H(super_token), timeout=15)
        assert r.status_code == 200

    def test_update_settings(self, super_token):
        r = requests.put(f"{API}/settings",
                         json={"nama": "Yayasan Test", "tagline": "TEST"},
                         headers=H(super_token), timeout=15)
        assert r.status_code == 200

    def test_backup(self, super_token):
        r = requests.get(f"{API}/backup", headers=H(super_token), timeout=30)
        assert r.status_code == 200
        d = r.json()
        for c in ["cabang", "jamaah", "guru"]:
            assert c in d


# ---------- Audit ----------
class TestAudit:
    def test_logs(self, super_token):
        r = requests.get(f"{API}/audit-logs", headers=H(super_token), timeout=15)
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list) and len(logs) > 0
        actions = {l.get("action") for l in logs}
        assert "LOGIN" in actions
