"""
H-04 regression tests: restore must never destroy existing data before the
payload is fully validated, must snapshot before destructive operations, and
must roll back on failure.

Offline tests only (no network, no real database).
"""
import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

import server

BACKUP_COLLECTIONS = server.BACKUP_COLLECTIONS


def run(coro):
    return asyncio.run(coro)


SUPER = {"id": "super-id", "role": "super_admin"}
NON_SUPER_ROLES = ["admin_cabang", "viewer", "penerus_ilmu", "ketua_yayasan"]


# ---------------------------------------------------------------- fake DB
def _matches(doc, query):
    return all(doc.get(key) == value for key, value in (query or {}).items())


class FakeCursor:
    def __init__(self, docs):
        self.docs = copy.deepcopy(docs)

    def sort(self, key=None, direction=1):
        if key:
            self.docs.sort(key=lambda d: d.get(key), reverse=(direction < 0))
        return self

    def __aiter__(self):
        self._iterator = iter(self.docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iterator)
        except StopIteration:
            raise StopAsyncIteration


class FakeCollection:
    def __init__(self, docs=None, fail_insert_many_once=False):
        self.docs = copy.deepcopy(list(docs or []))
        self.delete_calls = []
        self.inserted = []
        self.fail_insert_many_once = fail_insert_many_once

    def find(self, query=None, *_args, **_kwargs):
        return FakeCursor([d for d in self.docs if _matches(d, query or {})])

    async def find_one(self, query=None, *_args, **_kwargs):
        return copy.deepcopy(
            next((d for d in self.docs if _matches(d, query or {})), None)
        )

    async def insert_one(self, document):
        doc = copy.deepcopy(document)
        self.docs.append(doc)
        self.inserted.append(doc)
        return SimpleNamespace(inserted_id=ObjectId())

    async def insert_many(self, documents):
        if self.fail_insert_many_once:
            self.fail_insert_many_once = False
            raise RuntimeError("simulated insert_many failure")
        batch = [copy.deepcopy(d) for d in documents]
        self.docs.extend(batch)
        self.inserted.extend(batch)
        return SimpleNamespace(inserted_count=len(batch))

    async def delete_many(self, query):
        self.delete_calls.append(copy.deepcopy(query or {}))
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches(d, query or {})]
        return SimpleNamespace(deleted_count=before - len(self.docs))


class FakeDB:
    def __init__(self, collections=None):
        self._collections = collections or {}
        self.audit_logs = FakeCollection()
        self.users = FakeCollection()

    def __getitem__(self, name):
        return self._collections.setdefault(name, FakeCollection())

    def __getattr__(self, name):
        return self._collections.get(name, FakeCollection())


def seed_docs():
    return {
        "cabang": [{"_id": ObjectId(), "id_cabang": "CAB-0001", "kota": "Jakarta"}],
        "guru": [{"_id": ObjectId(), "id_guru": "GUR-0001", "nama": "Ustadz A", "cabang_id": "CAB-0001"}],
        "jamaah": [{"_id": ObjectId(), "id_jamaah": "JAM-0001", "nama": "Siti", "cabang_id": "CAB-0001", "guru_id": "GUR-0001"}],
        "pengurus": [{"_id": ObjectId(), "id_pengurus": "PGR-0001", "nama": "Budi", "jamaah_id": "JAM-0001", "cabang_id": "CAB-0001"}],
        "agenda": [{"_id": ObjectId(), "judul": "Dzikir", "cabang_id": "CAB-0001"}],
        "galeri": [{"_id": ObjectId(), "judul": "Foto", "type": "photo", "url": "http://old", "published": True}],
        "pengumuman": [{"_id": ObjectId(), "judul": "Info", "isi": "x", "kategori": "Umum"}],
        "settings": [{"_id": ObjectId(), "key": "yayasan", "nama": "Yayasan Lama"}],
        "messages": [{"_id": ObjectId(), "nama": "Pengirim", "pesan": "halo"}],
    }


def make_db(collections=None):
    docs = seed_docs()
    if collections:
        docs.update(collections)
    return FakeDB({name: FakeCollection(doc_list) for name, doc_list in docs.items()})


def valid_payload(**overrides):
    payload = {
        "format_version": server.BACKUP_FORMAT_VERSION,
        "created_at": "2026-01-02T00:00:00Z",
        "generated_by": "raudhatuljannah-backup",
        "cabang": [{"id_cabang": "CAB-0002", "kota": "Baru"}],
        "guru": [{"id_guru": "GUR-0002", "nama": "Ustadz B", "cabang_id": "CAB-0002"}],
        "jamaah": [{"id_jamaah": "JAM-0002", "nama": "Aisyah", "cabang_id": "CAB-0002", "guru_id": "GUR-0002"}],
        "pengurus": [{"id_pengurus": "PGR-0002", "nama": "Hasan", "jamaah_id": "JAM-0002", "cabang_id": "CAB-0002"}],
        "agenda": [{"judul": "Kajian", "cabang_id": "CAB-0002"}],
        "galeri": [{"judul": "Foto Baru", "type": "photo", "url": "http://new", "published": True}],
        "pengumuman": [{"judul": "Info Baru", "isi": "y", "kategori": "Umum"}],
        "settings": [{"key": "yayasan", "nama": "Yayasan Baru"}],
        "messages": [{"nama": "Orang", "pesan": "test"}],
    }
    payload.update(overrides)
    return payload


def snapshot_docs(db):
    return db[server.SNAPSHOT_COLLECTION].docs


def assert_untouched(db, original):
    for col in BACKUP_COLLECTIONS:
        assert db[col].delete_calls == [], f"{col} delete_many was called"
        assert db[col].docs == original[col], f"{col} was modified"


# ---------------------------------------------------------------- TEST A
def test_a_invalid_backup_rejected_without_db_access(monkeypatch):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    original = {c: copy.deepcopy(db[c].docs) for c in BACKUP_COLLECTIONS}

    with pytest.raises(HTTPException) as exc:
        run(server.restore({"format_version": 1, "cabang": "not-a-list"}, SUPER))

    assert exc.value.status_code == 400
    assert_untouched(db, original)
    assert snapshot_docs(db) == []


# ---------------------------------------------------------------- TEST B
@pytest.mark.parametrize("bad_version", [2, "1", 99, None])
def test_b_unknown_version_rejected_without_db_access(monkeypatch, bad_version):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    original = {c: copy.deepcopy(db[c].docs) for c in BACKUP_COLLECTIONS}

    payload = valid_payload()
    if bad_version is None:
        payload.pop("format_version")
    else:
        payload["format_version"] = bad_version

    with pytest.raises(HTTPException) as exc:
        run(server.restore(payload, SUPER))

    assert exc.value.status_code == 400
    assert_untouched(db, original)
    assert snapshot_docs(db) == []


# ---------------------------------------------------------------- TEST C
@pytest.mark.parametrize("missing_col", ["messages", "settings", "cabang", "jamaah"])
def test_c_missing_required_collection_rejected(monkeypatch, missing_col):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    original = {c: copy.deepcopy(db[c].docs) for c in BACKUP_COLLECTIONS}

    payload = valid_payload()
    payload.pop(missing_col)

    with pytest.raises(HTTPException) as exc:
        run(server.restore(payload, SUPER))

    assert exc.value.status_code == 400
    assert_untouched(db, original)
    assert snapshot_docs(db) == []


# ---------------------------------------------------------------- TEST D
@pytest.mark.parametrize("corrupt", [
    {"jamaah": ["this-is-not-a-dict"]},
    {"cabang": [{}]},
    {"jamaah": [{"id_jamaah": "JAM-2", "nama": "X", "cabang_id": 123, "guru_id": "G"}], },
    {"pengurus": [{"id_pengurus": "P1", "jamaah_id": "", "cabang_id": "C"}]},
    {"guru": [{"id_guru": "G", "nama": "X", "cabang_ids": [1, 2]}]},
])
def test_d_invalid_data_rejected_before_destructive_operation(monkeypatch, corrupt):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    original = {c: copy.deepcopy(db[c].docs) for c in BACKUP_COLLECTIONS}

    payload = valid_payload(**corrupt)

    with pytest.raises(HTTPException) as exc:
        run(server.restore(payload, SUPER))

    assert exc.value.status_code == 400
    assert_untouched(db, original)
    assert snapshot_docs(db) == []


# ---------------------------------------------------------------- TEST E
def test_e_snapshot_failure_aborts_before_destructive_operation(monkeypatch):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    monkeypatch.setattr(server, "_snapshot_existing_data", _raise_runtime)
    original = {c: copy.deepcopy(db[c].docs) for c in BACKUP_COLLECTIONS}

    with pytest.raises(HTTPException) as exc:
        run(server.restore(valid_payload(), SUPER))

    assert exc.value.status_code == 500
    assert_untouched(db, original)


def _raise_runtime(*_args, **_kwargs):
    raise RuntimeError("simulated snapshot failure")


# ---------------------------------------------------------------- TEST F
def test_f_valid_restore_succeeds_and_applies_payload(monkeypatch):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    payload = valid_payload()

    result = run(server.restore(payload, SUPER))

    assert result == {"message": "Database berhasil dipulihkan"}
    for col in BACKUP_COLLECTIONS:
        expected_rows = [
            {k: v for k, v in row.items() if k not in {"id", "_id"}}
            for row in payload[col]
        ]
        assert [dict(d) for d in db[col].docs] == expected_rows, f"{col} mismatch"
    assert snapshot_docs(db) == []
    actions = {log["action"] for log in db.audit_logs.inserted}
    assert "UPDATE" in actions


# ---------------------------------------------------------------- TEST G
def test_g_failure_after_destructive_step_triggers_rollback(monkeypatch):
    db = make_db()
    db._collections["jamaah"] = FakeCollection(
        seed_docs()["jamaah"], fail_insert_many_once=True
    )
    monkeypatch.setattr(server, "db", db)
    original = {c: copy.deepcopy(db[c].docs) for c in BACKUP_COLLECTIONS}
    assert len(db.jamaah.docs) == 1

    with pytest.raises(HTTPException) as exc:
        run(server.restore(valid_payload(), SUPER))

    assert exc.value.status_code == 500
    assert "dikembalikan ke kondisi sebelumnya" in exc.value.detail
    for col in BACKUP_COLLECTIONS:
        assert db[col].docs == original[col], f"{col} was not rolled back"
    assert snapshot_docs(db) == []


# ---------------------------------------------------------------- TEST H
@pytest.mark.parametrize("role", NON_SUPER_ROLES)
def test_h_non_super_roles_are_rejected(monkeypatch, role):
    db = make_db()
    monkeypatch.setattr(server, "db", db)
    actor = {"id": f"{role}-id", "role": role, "cabang_id": "branch-id"}

    with pytest.raises(HTTPException) as exc:
        run(server.restore(valid_payload(), actor))

    assert exc.value.status_code == 403
    for col in BACKUP_COLLECTIONS:
        assert db[col].delete_calls == []
    assert snapshot_docs(db) == []


# ---------------------------------------------------------------- TEST I
def test_i_restore_error_does_not_leak_payload_secrets(caplog, monkeypatch):
    sentinel = "SENTINEL-SECRET-abcdef123456"
    db = make_db()
    db._collections["jamaah"] = FakeCollection(
        seed_docs()["jamaah"], fail_insert_many_once=True
    )
    monkeypatch.setattr(server, "db", db)

    payload = valid_payload()
    payload["settings"][0]["wa_api_key"] = sentinel
    payload["messages"][0]["token"] = sentinel

    with caplog.at_level("ERROR", logger="server"):
        with pytest.raises(HTTPException) as exc:
            run(server.restore(payload, SUPER))

    assert exc.value.status_code == 500
    assert sentinel not in exc.value.detail
    assert sentinel not in caplog.text
