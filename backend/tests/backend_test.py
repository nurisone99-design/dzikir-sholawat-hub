"""
Backend API tests for Yayasan Raudhatul Jannah Admin Portal
Covers: auth, RBAC, CRUD, dashboard, exports, backup, public endpoints.
"""
import os
import io
import asyncio
import sys
import uuid
from pathlib import Path
from fastapi import HTTPException
import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from access_control import (
    get_data_scope,
    require_branch_assignment,
    require_official_role,
    require_roles,
    require_super_admin,
    require_write_access,
    scoped_query,
)
from seed import demo_seed_enabled, seed_all

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dzikir-sholawat-hub.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

def _env_cred(env_name, email):
    password = os.environ.get(env_name)
    if not password:
        return None
    return {"email": email, "password": password}


SUPER = _env_cred("SEED_DEMO_ADMIN_PASSWORD", "admin@raudhatuljannah.id")
CABANG_USER = _env_cred("SEED_DEMO_CABANG_PASSWORD", "cabang@raudhatuljannah.id")
VIEWER = _env_cred("SEED_DEMO_VIEWER_PASSWORD", "viewer@raudhatuljannah.id")

pytestmark = pytest.mark.skipif(
    SUPER is None or CABANG_USER is None or VIEWER is None,
    reason="Demo seed credentials (SEED_DEMO_*_PASSWORD) not configured",
)


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


# ---------- Branch scope helpers ----------
class TestBranchScopeHelpers:
    def test_super_admin_has_unrestricted_scope(self):
        assert get_data_scope({"role": "super_admin"}) is None

    @pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
    def test_branch_scoped_roles_receive_their_branch_filter(self, role):
        assert get_data_scope({"role": role, "cabang_id": "cabang-1"}) == {
            "cabang_id": "cabang-1"
        }

    @pytest.mark.parametrize("role", ["admin_cabang", "viewer"])
    def test_branch_scoped_roles_require_an_assignment(self, role):
        with pytest.raises(HTTPException) as exc:
            require_branch_assignment({"role": role})

        assert exc.value.status_code == 403

    def test_unknown_role_is_denied_a_data_scope(self):
        with pytest.raises(HTTPException) as exc:
            get_data_scope({"role": "unknown", "cabang_id": "cabang-1"})

        assert exc.value.status_code == 403

    @pytest.mark.parametrize(
        "role",
        ["super_admin", "admin_cabang", "viewer", "penerus_ilmu", "ketua_yayasan"],
    )
    def test_official_roles_are_accepted(self, role):
        assert require_official_role({"role": role}) == role

    @pytest.mark.parametrize("role", ["penerus_ilmu", "ketua_yayasan"])
    def test_global_readonly_roles_have_unrestricted_read_scope(self, role):
        assert get_data_scope({"role": role}) is None

    @pytest.mark.parametrize("user", [{}, {"role": "unknown"}, {"role": None}])
    def test_missing_and_unknown_roles_are_denied_by_default(self, user):
        with pytest.raises(HTTPException) as exc:
            require_official_role(user)

        assert exc.value.status_code == 403

    def test_super_admin_guard_is_default_deny(self):
        require_super_admin({"role": "super_admin"})

        for role in ("admin_cabang", "viewer", "unknown"):
            with pytest.raises(HTTPException) as exc:
                require_super_admin({"role": role})
            assert exc.value.status_code == 403

    @pytest.mark.parametrize("role", ["super_admin", "admin_cabang"])
    def test_write_access_allows_only_write_roles(self, role):
        require_write_access({"role": role})

    @pytest.mark.parametrize(
        "role", ["viewer", "penerus_ilmu", "ketua_yayasan", "unknown"]
    )
    def test_write_access_denies_viewer_and_unknown_role(self, role):
        with pytest.raises(HTTPException) as exc:
            require_write_access({"role": role})
        assert exc.value.status_code == 403

    def test_explicit_role_guard_does_not_trust_unlisted_roles(self):
        require_roles({"role": "viewer"}, {"viewer"})

        with pytest.raises(HTTPException) as exc:
            require_roles({"role": "unknown"}, {"unknown"})
        assert exc.value.status_code == 403

    def test_scoped_query_cannot_be_overridden_by_caller_filter(self):
        assert scoped_query(
            {"cabang_id": "branch-a"}, {"cabang_id": "branch-b", "status": "active"}
        ) == {
            "$and": [
                {"cabang_id": "branch-a"},
                {"cabang_id": "branch-b", "status": "active"},
            ]
        }


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
                          json={"email": "admin", "password": SUPER["password"]}, timeout=15)
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


class TestSecurityCoreAuthorization:
    SUPER_ONLY_GET_ENDPOINTS = ["/users", "/audit-logs", "/settings", "/messages"]

    @pytest.mark.parametrize("endpoint", SUPER_ONLY_GET_ENDPOINTS)
    def test_super_admin_can_read_super_only_endpoints(self, super_token, endpoint):
        response = requests.get(f"{API}{endpoint}", headers=H(super_token), timeout=15)
        assert response.status_code == 200, response.text

    @pytest.mark.parametrize("endpoint", SUPER_ONLY_GET_ENDPOINTS)
    @pytest.mark.parametrize("token_fixture", ["cabang_token", "viewer_token"])
    def test_non_super_roles_cannot_read_super_only_endpoints(
        self, request, endpoint, token_fixture
    ):
        token = request.getfixturevalue(token_fixture)
        response = requests.get(f"{API}{endpoint}", headers=H(token), timeout=15)
        assert response.status_code == 403, response.text

    @pytest.mark.parametrize("endpoint", SUPER_ONLY_GET_ENDPOINTS)
    def test_super_only_endpoints_require_authentication(self, endpoint):
        response = requests.get(f"{API}{endpoint}", timeout=15)
        assert response.status_code == 401, response.text

    @pytest.mark.parametrize("token_fixture", ["cabang_token", "viewer_token"])
    def test_non_super_roles_cannot_update_private_settings(self, request, token_fixture):
        token = request.getfixturevalue(token_fixture)
        response = requests.put(
            f"{API}/settings",
            json={"nama": "SHOULD_NOT_BE_APPLIED"},
            headers=H(token),
            timeout=15,
        )
        assert response.status_code == 403, response.text

    @pytest.mark.parametrize("token_fixture", ["cabang_token", "viewer_token"])
    def test_non_super_roles_cannot_delete_messages(self, request, token_fixture):
        token = request.getfixturevalue(token_fixture)
        response = requests.delete(
            f"{API}/messages/000000000000000000000000",
            headers=H(token),
            timeout=15,
        )
        assert response.status_code == 403, response.text

    def test_viewer_upload_is_forbidden_and_creates_no_local_file(self, viewer_token):
        upload_root = Path(__file__).resolve().parents[1] / "uploads"
        before = {path.resolve() for path in upload_root.rglob("*") if path.is_file()}

        response = requests.post(
            f"{API}/upload/jamaah",
            files={"file": ("forbidden.png", io.BytesIO(b"not-an-image"), "image/png")},
            headers=H(viewer_token),
            timeout=15,
        )

        after = {path.resolve() for path in upload_root.rglob("*") if path.is_file()}
        assert response.status_code == 403, response.text
        assert "url" not in response.text
        assert after == before


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


# ---------- Jamaah branch scope ----------
class TestJamaahBranchScope:
    @classmethod
    def setup_class(cls):
        cls.super_token = requests.post(f"{API}/auth/login", json=SUPER, timeout=15).json()["token"]
        cls.tag = uuid.uuid4().hex[:10]
        cls.member_ids = []

        cls.branch_a = cls._create_branch("A")
        cls.branch_b = cls._create_branch("B")
        cls.admin_token = cls._create_scoped_user("admin_cabang", cls.branch_a, "admin")
        cls.viewer_token = cls._create_scoped_user("viewer", cls.branch_a, "viewer")
        cls.member_a = cls._create_member(cls.branch_a, "A")
        cls.member_b = cls._create_member(cls.branch_b, "B")

    @classmethod
    def teardown_class(cls):
        for member_id in cls.member_ids:
            requests.delete(f"{API}/jamaah/{member_id}", headers=H(cls.super_token), timeout=15)
        for user_id in getattr(cls, "user_ids", []):
            requests.delete(f"{API}/users/{user_id}", headers=H(cls.super_token), timeout=15)
        for branch_id in (getattr(cls, "branch_a", None), getattr(cls, "branch_b", None)):
            if branch_id:
                requests.delete(f"{API}/cabang/{branch_id}", headers=H(cls.super_token), timeout=15)

    @classmethod
    def _create_branch(cls, suffix):
        response = requests.post(
            f"{API}/cabang",
            json={
                "id_cabang": f"SCOPE-{cls.tag}-{suffix}",
                "kota": f"TEST_SCOPE_{cls.tag}_{suffix}",
                "alamat": "Jl. Scope Test",
                "ketua": "Scope Tester",
                "no_hp": "0800000000",
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        return response.json()["id"]

    @classmethod
    def _create_scoped_user(cls, role, cabang_id, label):
        response = requests.post(
            f"{API}/users",
            json={
                "username": f"scope_{label}_{cls.tag}",
                "email": f"scope_{label}_{cls.tag}@example.test",
                "password": "ScopePass@2026",
                "role": role,
                "status": "active",
                "cabang_id": cabang_id,
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        cls.user_ids = getattr(cls, "user_ids", []) + [response.json()["id"]]
        login = requests.post(
            f"{API}/auth/login",
            json={"email": f"scope_{label}_{cls.tag}@example.test", "password": "ScopePass@2026"},
            timeout=15,
        )
        assert login.status_code == 200, login.text
        return login.json()["token"]

    @classmethod
    def _create_member(cls, cabang_id, suffix):
        response = requests.post(
            f"{API}/jamaah",
            json={
                "nama": f"TEST_SCOPE_MEMBER_{cls.tag}_{suffix}",
                "nik": f"SCOPE-{cls.tag}-{suffix}",
                "gender": "Laki-laki",
                "cabang_id": cabang_id,
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        member_id = response.json()["id"]
        cls.member_ids.append(member_id)
        return member_id

    def test_list_returns_only_assigned_branch_members(self):
        response = requests.get(f"{API}/jamaah", headers=H(self.admin_token), timeout=15)
        assert response.status_code == 200, response.text
        ids = {row["id"] for row in response.json()}
        assert self.member_a in ids
        assert self.member_b not in ids

    def test_detail_denies_other_branch_member(self):
        own = requests.get(f"{API}/jamaah/{self.member_a}", headers=H(self.admin_token), timeout=15)
        other = requests.get(f"{API}/jamaah/{self.member_b}", headers=H(self.admin_token), timeout=15)
        assert own.status_code == 200, own.text
        assert other.status_code == 404, other.text

    def test_create_forces_the_assigned_branch(self):
        response = requests.post(
            f"{API}/jamaah",
            json={
                "nama": f"TEST_SCOPE_FORCED_{self.tag}",
                "nik": f"FORCED-{self.tag}",
                "gender": "Perempuan",
                "cabang_id": self.branch_b,
            },
            headers=H(self.admin_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        self.member_ids.append(data["id"])
        assert data["cabang_id"] == self.branch_a

    def test_update_keeps_member_in_the_assigned_branch_and_denies_other_branch(self):
        own = requests.put(
            f"{API}/jamaah/{self.member_a}",
            json={"nama": "TEST_SCOPE_UPDATED", "cabang_id": self.branch_b},
            headers=H(self.admin_token),
            timeout=15,
        )
        other = requests.put(
            f"{API}/jamaah/{self.member_b}",
            json={"nama": "TEST_SCOPE_CROSS_BRANCH"},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert own.status_code == 200, own.text
        assert own.json()["cabang_id"] == self.branch_a
        assert other.status_code == 404, other.text

    def test_delete_denies_other_branch_member_and_allows_own_member(self):
        own_member = self._create_member(self.branch_a, "DELETE")
        other_member = self._create_member(self.branch_b, "DELETE")
        other = requests.delete(f"{API}/jamaah/{other_member}", headers=H(self.admin_token), timeout=15)
        own = requests.delete(f"{API}/jamaah/{own_member}", headers=H(self.admin_token), timeout=15)
        assert other.status_code == 404, other.text
        assert own.status_code == 200, own.text
        self.member_ids.remove(own_member)

    def test_bulk_delete_rejects_cross_branch_ids(self):
        own_member = self._create_member(self.branch_a, "BULK")
        other_member = self._create_member(self.branch_b, "BULK")
        mixed = requests.post(
            f"{API}/jamaah/bulk-delete",
            json={"ids": [own_member, other_member]},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert mixed.status_code == 404, mixed.text

        own = requests.post(
            f"{API}/jamaah/bulk-delete",
            json={"ids": [own_member]},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert own.status_code == 200, own.text
        self.member_ids.remove(own_member)

    def test_viewer_reads_assigned_branch_but_cannot_create(self):
        listed = requests.get(f"{API}/jamaah", headers=H(self.viewer_token), timeout=15)
        create = requests.post(
            f"{API}/jamaah",
            json={"nama": "TEST_SCOPE_VIEWER", "cabang_id": self.branch_b},
            headers=H(self.viewer_token),
            timeout=15,
        )
        assert listed.status_code == 200, listed.text
        ids = {row["id"] for row in listed.json()}
        assert self.member_a in ids
        assert self.member_b not in ids
        assert create.status_code == 403, create.text


# ---------- Guru branch scope ----------
class TestGuruBranchScope:
    @classmethod
    def setup_class(cls):
        cls.super_token = requests.post(f"{API}/auth/login", json=SUPER, timeout=15).json()["token"]
        cls.tag = uuid.uuid4().hex[:10]
        cls.guru_ids = []
        cls.user_ids = []

        cls.branch_a = cls._create_branch("A")
        cls.branch_b = cls._create_branch("B")
        cls.admin_token = cls._create_scoped_user("admin_cabang", cls.branch_a, "admin")
        cls.viewer_token = cls._create_scoped_user("viewer", cls.branch_a, "viewer")
        cls.guru_a = cls._create_guru([cls.branch_a], "A")
        cls.guru_b = cls._create_guru([cls.branch_b], "B")
        cls.guru_shared = cls._create_guru([cls.branch_a, cls.branch_b], "SHARED")

    @classmethod
    def teardown_class(cls):
        for guru_id in cls.guru_ids:
            requests.delete(f"{API}/guru/{guru_id}", headers=H(cls.super_token), timeout=15)
        for user_id in cls.user_ids:
            requests.delete(f"{API}/users/{user_id}", headers=H(cls.super_token), timeout=15)
        for branch_id in (getattr(cls, "branch_a", None), getattr(cls, "branch_b", None)):
            if branch_id:
                requests.delete(f"{API}/cabang/{branch_id}", headers=H(cls.super_token), timeout=15)

    @classmethod
    def _create_branch(cls, suffix):
        response = requests.post(
            f"{API}/cabang",
            json={
                "id_cabang": f"GURU-SCOPE-{cls.tag}-{suffix}",
                "kota": f"TEST_GURU_SCOPE_{cls.tag}_{suffix}",
                "alamat": "Jl. Guru Scope Test",
                "ketua": "Guru Scope Tester",
                "no_hp": "0800000000",
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        return response.json()["id"]

    @classmethod
    def _create_scoped_user(cls, role, cabang_id, label):
        email = f"guru_scope_{label}_{cls.tag}@example.test"
        response = requests.post(
            f"{API}/users",
            json={
                "username": f"guru_scope_{label}_{cls.tag}",
                "email": email,
                "password": "GuruScopePass@2026",
                "role": role,
                "status": "active",
                "cabang_id": cabang_id,
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        cls.user_ids.append(response.json()["id"])
        login = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "GuruScopePass@2026"},
            timeout=15,
        )
        assert login.status_code == 200, login.text
        return login.json()["token"]

    @classmethod
    def _create_guru(cls, cabang_ids, suffix):
        response = requests.post(
            f"{API}/guru",
            json={
                "id_guru": f"GURU-SCOPE-{cls.tag}-{suffix}",
                "nama": f"TEST_GURU_SCOPE_{cls.tag}_{suffix}",
                "cabang_ids": cabang_ids,
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        guru_id = response.json()["id"]
        cls.guru_ids.append(guru_id)
        return guru_id

    def test_list_returns_assigned_and_shared_guru_only(self):
        response = requests.get(f"{API}/guru", headers=H(self.admin_token), timeout=15)
        assert response.status_code == 200, response.text
        rows = {row["id"]: row for row in response.json()}
        assert self.guru_a in rows
        assert self.guru_shared in rows
        assert self.guru_b not in rows
        assert rows[self.guru_shared]["cabang_ids"] == [self.branch_a]

    def test_detail_denies_other_branch_guru(self):
        own = requests.get(f"{API}/guru/{self.guru_shared}", headers=H(self.admin_token), timeout=15)
        other = requests.get(f"{API}/guru/{self.guru_b}", headers=H(self.admin_token), timeout=15)
        assert own.status_code == 200, own.text
        assert own.json()["cabang_ids"] == [self.branch_a]
        assert other.status_code == 404, other.text

    def test_create_forces_the_assigned_branch(self):
        response = requests.post(
            f"{API}/guru",
            json={
                "id_guru": f"GURU-SCOPE-{self.tag}-FORCED",
                "nama": "TEST_GURU_FORCED_BRANCH",
                "cabang_id": self.branch_b,
                "cabang_ids": [self.branch_b],
            },
            headers=H(self.admin_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        self.guru_ids.append(data["id"])
        assert data["cabang_ids"] == [self.branch_a]

    def test_update_preserves_server_side_branch_membership_and_denies_other_branch(self):
        own = requests.put(
            f"{API}/guru/{self.guru_shared}",
            json={"nama": "TEST_GURU_SHARED_UPDATED", "cabang_ids": [self.branch_b]},
            headers=H(self.admin_token),
            timeout=15,
        )
        other = requests.put(
            f"{API}/guru/{self.guru_b}",
            json={"nama": "TEST_GURU_CROSS_BRANCH"},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert own.status_code == 200, own.text
        assert own.json()["cabang_ids"] == [self.branch_a]
        assert other.status_code == 404, other.text

    def test_delete_denies_other_branch_guru_and_allows_own_guru(self):
        own_guru = self._create_guru([self.branch_a], "DELETE")
        other_guru = self._create_guru([self.branch_b], "DELETE")
        other = requests.delete(f"{API}/guru/{other_guru}", headers=H(self.admin_token), timeout=15)
        own = requests.delete(f"{API}/guru/{own_guru}", headers=H(self.admin_token), timeout=15)
        assert other.status_code == 404, other.text
        assert own.status_code == 200, own.text
        self.guru_ids.remove(own_guru)

    def test_bulk_delete_rejects_cross_branch_ids(self):
        own_guru = self._create_guru([self.branch_a], "BULK")
        other_guru = self._create_guru([self.branch_b], "BULK")
        mixed = requests.post(
            f"{API}/guru/bulk-delete",
            json={"ids": [own_guru, other_guru]},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert mixed.status_code == 404, mixed.text

        own = requests.post(
            f"{API}/guru/bulk-delete",
            json={"ids": [own_guru]},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert own.status_code == 200, own.text
        self.guru_ids.remove(own_guru)

    def test_viewer_reads_assigned_branch_but_cannot_create(self):
        listed = requests.get(f"{API}/guru", headers=H(self.viewer_token), timeout=15)
        create = requests.post(
            f"{API}/guru",
            json={"nama": "TEST_GURU_VIEWER", "cabang_ids": [self.branch_b]},
            headers=H(self.viewer_token),
            timeout=15,
        )
        assert listed.status_code == 200, listed.text
        ids = {row["id"] for row in listed.json()}
        assert self.guru_a in ids
        assert self.guru_b not in ids
        assert create.status_code == 403, create.text


# ---------- Pengurus branch scope ----------
class TestPengurusBranchScope:
    @classmethod
    def setup_class(cls):
        cls.super_token = requests.post(f"{API}/auth/login", json=SUPER, timeout=15).json()["token"]
        cls.tag = uuid.uuid4().hex[:10]
        cls.pengurus_ids = []
        cls.user_ids = []

        cls.branch_a = cls._create_branch("A")
        cls.branch_b = cls._create_branch("B")
        cls.admin_token = cls._create_scoped_user("admin_cabang", cls.branch_a, "admin")
        cls.viewer_token = cls._create_scoped_user("viewer", cls.branch_a, "viewer")
        cls.pengurus_a = cls._create_pengurus(cls.branch_a, "A")
        cls.pengurus_b = cls._create_pengurus(cls.branch_b, "B")

    @classmethod
    def teardown_class(cls):
        for pengurus_id in cls.pengurus_ids:
            requests.delete(f"{API}/pengurus/{pengurus_id}", headers=H(cls.super_token), timeout=15)
        for user_id in cls.user_ids:
            requests.delete(f"{API}/users/{user_id}", headers=H(cls.super_token), timeout=15)
        for branch_id in (getattr(cls, "branch_a", None), getattr(cls, "branch_b", None)):
            if branch_id:
                requests.delete(f"{API}/cabang/{branch_id}", headers=H(cls.super_token), timeout=15)

    @classmethod
    def _create_branch(cls, suffix):
        response = requests.post(
            f"{API}/cabang",
            json={
                "id_cabang": f"PENGURUS-SCOPE-{cls.tag}-{suffix}",
                "kota": f"TEST_PENGURUS_SCOPE_{cls.tag}_{suffix}",
                "alamat": "Jl. Pengurus Scope Test",
                "ketua": "Pengurus Scope Tester",
                "no_hp": "0800000000",
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        return response.json()["id"]

    @classmethod
    def _create_scoped_user(cls, role, cabang_id, label):
        email = f"pengurus_scope_{label}_{cls.tag}@example.test"
        response = requests.post(
            f"{API}/users",
            json={
                "username": f"pengurus_scope_{label}_{cls.tag}",
                "email": email,
                "password": "PengurusScopePass@2026",
                "role": role,
                "status": "active",
                "cabang_id": cabang_id,
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        cls.user_ids.append(response.json()["id"])
        login = requests.post(
            f"{API}/auth/login",
            json={"email": email, "password": "PengurusScopePass@2026"},
            timeout=15,
        )
        assert login.status_code == 200, login.text
        return login.json()["token"]

    @classmethod
    def _create_pengurus(cls, cabang_id, suffix):
        response = requests.post(
            f"{API}/pengurus",
            json={
                "id_pengurus": f"PENGURUS-SCOPE-{cls.tag}-{suffix}",
                "nama": f"TEST_PENGURUS_SCOPE_{cls.tag}_{suffix}",
                "jabatan": "Pengurus Test",
                "cabang_id": cabang_id,
            },
            headers=H(cls.super_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        pengurus_id = response.json()["id"]
        cls.pengurus_ids.append(pengurus_id)
        return pengurus_id

    def test_super_admin_sees_all_branch_records(self):
        response = requests.get(f"{API}/pengurus", headers=H(self.super_token), timeout=15)
        assert response.status_code == 200, response.text
        ids = {row["id"] for row in response.json()}
        assert self.pengurus_a in ids
        assert self.pengurus_b in ids

    def test_admin_cabang_sees_only_its_branch_records(self):
        response = requests.get(f"{API}/pengurus", headers=H(self.admin_token), timeout=15)
        assert response.status_code == 200, response.text
        ids = {row["id"] for row in response.json()}
        assert self.pengurus_a in ids
        assert self.pengurus_b not in ids

    def test_viewer_reads_assigned_branch_but_cannot_create(self):
        listed = requests.get(f"{API}/pengurus", headers=H(self.viewer_token), timeout=15)
        create = requests.post(
            f"{API}/pengurus",
            json={"nama": "TEST_PENGURUS_VIEWER", "cabang_id": self.branch_b},
            headers=H(self.viewer_token),
            timeout=15,
        )
        assert listed.status_code == 200, listed.text
        ids = {row["id"] for row in listed.json()}
        assert self.pengurus_a in ids
        assert self.pengurus_b not in ids
        assert create.status_code == 403, create.text

    def test_create_forces_the_assigned_branch(self):
        response = requests.post(
            f"{API}/pengurus",
            json={
                "id_pengurus": f"PENGURUS-SCOPE-{self.tag}-FORCED",
                "nama": "TEST_PENGURUS_FORCED_BRANCH",
                "jabatan": "Pengurus Test",
                "cabang_id": self.branch_b,
            },
            headers=H(self.admin_token),
            timeout=15,
        )
        assert response.status_code == 200, response.text
        data = response.json()
        self.pengurus_ids.append(data["id"])
        assert data["cabang_id"] == self.branch_a

    def test_update_preserves_branch_and_denies_other_branch(self):
        own = requests.put(
            f"{API}/pengurus/{self.pengurus_a}",
            json={"nama": "TEST_PENGURUS_UPDATED", "cabang_id": self.branch_b},
            headers=H(self.admin_token),
            timeout=15,
        )
        other = requests.put(
            f"{API}/pengurus/{self.pengurus_b}",
            json={"nama": "TEST_PENGURUS_CROSS_BRANCH"},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert own.status_code == 200, own.text
        assert own.json()["cabang_id"] == self.branch_a
        assert other.status_code == 404, other.text

    def test_delete_denies_other_branch_record(self):
        own_record = self._create_pengurus(self.branch_a, "DELETE")
        other_record = self._create_pengurus(self.branch_b, "DELETE")
        other = requests.delete(f"{API}/pengurus/{other_record}", headers=H(self.admin_token), timeout=15)
        own = requests.delete(f"{API}/pengurus/{own_record}", headers=H(self.admin_token), timeout=15)
        assert other.status_code == 404, other.text
        assert own.status_code == 200, own.text
        self.pengurus_ids.remove(own_record)

    def test_bulk_delete_rejects_cross_branch_records_entirely(self):
        own_record = self._create_pengurus(self.branch_a, "BULK")
        other_record = self._create_pengurus(self.branch_b, "BULK")
        mixed = requests.post(
            f"{API}/pengurus/bulk-delete",
            json={"ids": [own_record, other_record]},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert mixed.status_code == 404, mixed.text

        own = requests.post(
            f"{API}/pengurus/bulk-delete",
            json={"ids": [own_record]},
            headers=H(self.admin_token),
            timeout=15,
        )
        assert own.status_code == 200, own.text
        self.pengurus_ids.remove(own_record)


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
