from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
from PIL import Image
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Any, Dict, Annotated
import certifi
from pymongo import MongoClient


from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from bson import ObjectId
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# ------------------------------------------------------------------ config
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url, tlsCAFile=certifi.where())
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# Direktori Penyimpanan Upload Gambar
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Yayasan Raudhatul Jannah API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# ------------------------------------------------------------------ helpers
PyObjectId = Annotated[str, BeforeValidator(str)]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, role: str) -> str:
    payload = {"sub": user_id, "role": role,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def serialize(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc

def compress_and_convert_to_webp(image_bytes: bytes, max_size_kb: int = 50) -> bytes:
    """ Mengompres dan mengonversi gambar ke format WEBP dengan target ukuran <= max_size_kb KB """
    img = Image.open(io.BytesIO(image_bytes))
    
    # Konversi RGBA / Palette ke RGB agar kompatibel saat dikonversi ke WebP
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
        
    quality = 85
    output = io.BytesIO()
    
    # Batasi dimensi maksimal (1200px) untuk foto berukuran besar
    max_dim = 1200
    if max(img.width, img.height) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    # Loop penyesuaian kualitas & dimensi hingga ukuran <= 50 KB
    while True:
        output.seek(0)
        output.truncate(0)
        
        img.save(output, format="WEBP", quality=quality, optimize=True)
        size_kb = output.tell() / 1024
        
        if size_kb <= max_size_kb or quality <= 10:
            break
            
        quality -= 5
        
        # Jika kualitas sudah di bawah 20 namun masih > 50KB, turunkan resolusi pikselnya
        if quality < 20 and size_kb > max_size_kb:
            new_w = int(img.width * 0.8)
            new_h = int(img.height * 0.8)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
            quality = 50

    return output.getvalue()

async def get_current_user(request: Request,
                           creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    token = None
    if creds:
        token = creds.credentials
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        if user.get("status", "active") != "active":
            raise HTTPException(status_code=403, detail="Akun tidak aktif")
        return serialize(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

def require_write(user: dict):
    if user.get("role") == "viewer":
        raise HTTPException(status_code=403, detail="Akses hanya-baca. Anda tidak memiliki izin.")

def require_super(user: dict):
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang diizinkan.")

async def log_action(user: dict, action: str, entity: str, details: str = ""):
    await db.audit_logs.insert_one({
        "user_id": user.get("id"), "username": user.get("username") or user.get("email"),
        "action": action, "entity": entity, "details": details, "timestamp": now_iso()
    })

# ------------------------------------------------------------------ auth models
class LoginInput(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "viewer"
    status: str = "active"
    cabang_id: Optional[str] = None
    name: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    status: Optional[str] = None
    cabang_id: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    avatar: Optional[str] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

# ------------------------------------------------------------------ auth routes
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.strip().lower()
    user = await db.users.find_one({"$or": [{"email": email}, {"username": data.email.strip()}]})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if user.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Akun tidak aktif")
    token = create_access_token(str(user["_id"]), user.get("role", "viewer"))
    await db.audit_logs.insert_one({"user_id": str(user["_id"]),
        "username": user.get("username"), "action": "LOGIN", "entity": "auth",
        "details": "Login berhasil", "timestamp": now_iso()})
    return {"token": token, "user": serialize(user)}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api_router.put("/auth/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(get_current_user)):
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if upd:
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": upd})
    return serialize(await db.users.find_one({"_id": ObjectId(user["id"])}))

@api_router.put("/auth/password")
async def change_password(data: PasswordChange, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not verify_password(data.old_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Kata sandi lama salah")
    await db.users.update_one({"_id": ObjectId(user["id"])},
                              {"$set": {"password_hash": hash_password(data.new_password)}})
    await log_action(user, "UPDATE", "auth", "Ubah kata sandi")
    return {"message": "Kata sandi berhasil diubah"}

# ------------------------------------------------------------------ upload router
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_write(user)
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File yang diunggah harus berupa gambar")
        
    contents = await file.read()
    
    try:
        # Kompresi & Ubah format ke WEBP (Max 50KB)
        compressed_bytes = compress_and_convert_to_webp(contents, max_size_kb=50)
        
        # Buat nama file unik
        base_name = Path(file.filename).stem
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        new_filename = f"{base_name}_{timestamp}.webp"
        file_path = UPLOAD_DIR / new_filename
        
        # Simpan file
        with open(file_path, "wb") as f:
            f.write(compressed_bytes)
            
        await log_action(user, "CREATE", "upload", f"Upload gambar: {new_filename}")
        
        return {
            "status": "success",
            "filename": new_filename,
            "url": f"/uploads/{new_filename}"
        }
    except Exception as e:
        logger.error(f"Gagal memproses gambar: {str(e)}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan saat memproses gambar")

# ------------------------------------------------------------------ user management
@api_router.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    docs = await db.users.find().sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(get_current_user)):
    require_super(user)
    email = data.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = data.model_dump()
    doc["email"] = email
    doc["password_hash"] = hash_password(doc.pop("password"))
    doc["created_at"] = now_iso()
    res = await db.users.insert_one(doc)
    await log_action(user, "CREATE", "users", f"Tambah user {email}")
    return serialize(await db.users.find_one({"_id": res.inserted_id}))

@api_router.put("/users/{uid}")
async def update_user(uid: str, data: UserUpdate, user: dict = Depends(get_current_user)):
    require_super(user)
    upd = {k: v for k, v in data.model_dump().items() if v is not None}
    if "password" in upd:
        upd["password_hash"] = hash_password(upd.pop("password"))
    if "email" in upd:
        upd["email"] = upd["email"].strip().lower()
    await db.users.update_one({"_id": ObjectId(uid)}, {"$set": upd})
    await log_action(user, "UPDATE", "users", f"Edit user {uid}")
    return serialize(await db.users.find_one({"_id": ObjectId(uid)}))

@api_router.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(get_current_user)):
    require_super(user)
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    await db.users.delete_one({"_id": ObjectId(uid)})
    await log_action(user, "DELETE", "users", f"Hapus user {uid}")
    return {"message": "User dihapus"}

# ------------------------------------------------------------------ generic CRUD factory
def make_crud(name: str, collection: str):
    @api_router.get(f"/{name}")
    async def _list(user: dict = Depends(get_current_user)):
        docs = await db[collection].find().sort("created_at", -1).to_list(5000)
        return [serialize(d) for d in docs]

    @api_router.get(f"/{name}/{{item_id}}")
    async def _get(item_id: str, user: dict = Depends(get_current_user)):
        doc = await db[collection].find_one({"_id": ObjectId(item_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        return serialize(doc)

    @api_router.post(f"/{name}")
    async def _create(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
        require_write(user)
        payload.pop("id", None)
        payload["created_at"] = now_iso()
        payload["updated_at"] = now_iso()
        res = await db[collection].insert_one(payload)
        await log_action(user, "CREATE", collection, payload.get("nama") or payload.get("judul") or "")
        return serialize(await db[collection].find_one({"_id": res.inserted_id}))

    @api_router.put(f"/{name}/{{item_id}}")
    async def _update(item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
        require_write(user)
        payload.pop("id", None)
        payload.pop("_id", None)
        payload["updated_at"] = now_iso()
        await db[collection].update_one({"_id": ObjectId(item_id)}, {"$set": payload})
        await log_action(user, "UPDATE", collection, item_id)
        return serialize(await db[collection].find_one({"_id": ObjectId(item_id)}))

    @api_router.delete(f"/{name}/{{item_id}}")
    async def _delete(item_id: str, user: dict = Depends(get_current_user)):
        require_write(user)
        await db[collection].delete_one({"_id": ObjectId(item_id)})
        await log_action(user, "DELETE", collection, item_id)
        return {"message": "Data dihapus"}

    @api_router.post(f"/{name}/bulk-delete")
    async def _bulk_delete(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
        require_write(user)
        ids = [ObjectId(i) for i in payload.get("ids", [])]
        await db[collection].delete_many({"_id": {"$in": ids}})
        await log_action(user, "DELETE", collection, f"Bulk hapus {len(ids)} data")
        return {"message": f"{len(ids)} data dihapus"}

for _n, _c in [("cabang", "cabang"), ("jamaah", "jamaah"),
               ("pengurus", "pengurus"), ("agenda", "agenda"), ("galeri", "galeri"),
               ("pengumuman", "pengumuman")]:
    make_crud(_n, _c)

# ------------------------------------------------------------------ guru
async def _enrich_guru(docs):
    cabang_map = {str(c["_id"]): c.get("kota", "") for c in await db.cabang.find().to_list(1000)}
    out = []
    for d in docs:
        d = serialize(d)
        cids = d.get("cabang_ids") or ([d["cabang_id"]] if d.get("cabang_id") else [])
        d["cabang_ids"] = cids
        d["cabang_nama"] = ", ".join([cabang_map[c] for c in cids if cabang_map.get(c)]) or "-"
        total = 0
        for cid in cids:
            total += await db.jamaah.count_documents({"cabang_id": cid})
        d["jumlah_jamaah"] = total
        out.append(d)
    return out

@api_router.get("/guru")
async def list_guru(user: dict = Depends(get_current_user)):
    docs = await db.guru.find().sort("created_at", -1).to_list(5000)
    return await _enrich_guru(docs)

@api_router.get("/guru/{item_id}")
async def get_guru(item_id: str, user: dict = Depends(get_current_user)):
    doc = await db.guru.find_one({"_id": ObjectId(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return (await _enrich_guru([doc]))[0]

@api_router.post("/guru")
async def create_guru(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    require_write(user)
    for k in ("id", "cabang_nama", "jumlah_jamaah"):
        payload.pop(k, None)
    payload["created_at"] = now_iso()
    payload["updated_at"] = now_iso()
    res = await db.guru.insert_one(payload)
    await log_action(user, "CREATE", "guru", payload.get("nama", ""))
    return (await _enrich_guru([await db.guru.find_one({"_id": res.inserted_id})]))[0]

@api_router.put("/guru/{item_id}")
async def update_guru(item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    require_write(user)
    for k in ("id", "_id", "cabang_nama", "jumlah_jamaah"):
        payload.pop(k, None)
    payload["updated_at"] = now_iso()
    await db.guru.update_one({"_id": ObjectId(item_id)}, {"$set": payload})
    await log_action(user, "UPDATE", "guru", item_id)
    return (await _enrich_guru([await db.guru.find_one({"_id": ObjectId(item_id)})]))[0]

@api_router.delete("/guru/{item_id}")
async def delete_guru(item_id: str, user: dict = Depends(get_current_user)):
    require_write(user)
    await db.guru.delete_one({"_id": ObjectId(item_id)})
    await log_action(user, "DELETE", "guru", item_id)
    return {"message": "Data dihapus"}

@api_router.post("/guru/bulk-delete")
async def bulk_delete_guru(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    require_write(user)
    ids = [ObjectId(i) for i in payload.get("ids", [])]
    await db.guru.delete_many({"_id": {"$in": ids}})
    await log_action(user, "DELETE", "guru", f"Bulk hapus {len(ids)} data")
    return {"message": f"{len(ids)} data dihapus"}

# ------------------------------------------------------------------ public endpoints
@api_router.get("/public/stats")
async def public_stats():
    return {
        "total_cabang": await db.cabang.count_documents({}),
        "total_guru": await db.guru.count_documents({}),
        "total_jamaah": await db.jamaah.count_documents({}),
        "total_agenda": await db.agenda.count_documents({}),
    }

@api_router.get("/public/cabang")
async def public_cabang():
    docs = await db.cabang.find().sort("kota", 1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.get("/public/agenda")
async def public_agenda():
    docs = await db.agenda.find().sort("tanggal", 1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.get("/public/pengumuman")
async def public_pengumuman():
    docs = await db.pengumuman.find().sort("created_at", -1).to_list(50)
    return [serialize(d) for d in docs]

@api_router.get("/public/galeri")
async def public_galeri():
    docs = await db.galeri.find({"published": True}).sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.get("/public/settings")
async def public_settings():
    doc = await db.settings.find_one({"key": "yayasan"})
    return serialize(doc) if doc else {}

class ContactInput(BaseModel):
    nama: str
    whatsapp: str
    pesan: str

@api_router.post("/public/contact")
async def public_contact(data: ContactInput):
    doc = data.model_dump()
    doc["created_at"] = now_iso()
    doc["read"] = False
    await db.messages.insert_one(doc)
    return {"message": "Pesan terkirim"}

@api_router.get("/messages")
async def list_messages(user: dict = Depends(get_current_user)):
    docs = await db.messages.find().sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.delete("/messages/{mid}")
async def delete_message(mid: str, user: dict = Depends(get_current_user)):
    require_write(user)
    await db.messages.delete_one({"_id": ObjectId(mid)})
    return {"message": "Pesan dihapus"}

# ------------------------------------------------------------------ dashboard
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_jamaah = await db.jamaah.count_documents({})
    now = datetime.now(timezone.utc).isoformat()
    active_events = await db.agenda.count_documents({"tanggal": {"$gte": now[:10]}})
    cabang_list = await db.cabang.find().to_list(1000)
    per_cabang = []
    for c in cabang_list:
        cnt = await db.jamaah.count_documents({"cabang_id": str(c["_id"])})
        per_cabang.append({"kota": c.get("kota", "-"), "jamaah": cnt})
    male = await db.jamaah.count_documents({"gender": "Laki-laki"})
    female = await db.jamaah.count_documents({"gender": "Perempuan"})
    upcoming = await db.agenda.find({"tanggal": {"$gte": now[:10]}}).sort("tanggal", 1).to_list(5)
    return {
        "total_cabang": await db.cabang.count_documents({}),
        "total_guru": await db.guru.count_documents({}),
        "total_jamaah": total_jamaah,
        "active_events": active_events,
        "per_cabang": per_cabang,
        "gender": {"male": male, "female": female},
        "upcoming_agenda": [serialize(a) for a in upcoming],
    }

# ------------------------------------------------------------------ audit log
@api_router.get("/audit-logs")
async def audit_logs(user: dict = Depends(get_current_user)):
    docs = await db.audit_logs.find().sort("timestamp", -1).to_list(1000)
    return [serialize(d) for d in docs]

# ------------------------------------------------------------------ settings
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "yayasan"})
    return serialize(doc) if doc else {}

@api_router.put("/settings")
async def update_settings(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    require_write(user)
    payload.pop("id", None)
    payload.pop("_id", None)
    payload["key"] = "yayasan"
    await db.settings.update_one({"key": "yayasan"}, {"$set": payload}, upsert=True)
    await log_action(user, "UPDATE", "settings", "Perbarui pengaturan sistem")
    return serialize(await db.settings.find_one({"key": "yayasan"}))

# ------------------------------------------------------------------ backup / restore
BACKUP_COLLECTIONS = ["cabang", "guru", "jamaah", "pengurus", "agenda", "galeri",
                      "pengumuman", "settings", "messages"]

@api_router.get("/backup")
async def backup(user: dict = Depends(get_current_user)):
    require_super(user)
    dump = {}
    for col in BACKUP_COLLECTIONS:
        docs = await db[col].find().to_list(100000)
        dump[col] = [serialize(d) for d in docs]
    await log_action(user, "EXPORT", "backup", "Backup database")
    return dump

@api_router.post("/restore")
async def restore(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    require_super(user)
    for col in BACKUP_COLLECTIONS:
        if col in payload:
            await db[col].delete_many({})
            rows = []
            for r in payload[col]:
                r.pop("id", None)
                r.pop("_id", None)
                rows.append(r)
            if rows:
                await db[col].insert_many(rows)
    await log_action(user, "UPDATE", "restore", "Restore database")
    return {"message": "Database berhasil dipulihkan"}

# ------------------------------------------------------------------ EXPORT HANDLER
COLUMN_TITLE_MAP = {
    "id": "ID",
    "id_jamaah": "ID Jamaah",
    "id_guru": "ID Guru",
    "id_cabang": "ID Cabang",
    "id_pengurus": "ID Pengurus",
    "nama": "Nama Lengkap",
    "nik": "NIK / No. KTP",
    "no_ktp": "NIK / No. KTP",
    "gender": "Gender",
    "tempat_lahir": "Tempat Lahir",
    "tanggal_lahir": "Tanggal Lahir",
    "alamat": "Alamat",
    "cabang": "Cabang",
    "cabang_nama": "Cabang",
    "no_hp": "No. HP / WA",
    "nama_ortu": "Nama Orang Tua",
    "nama_orang_tua": "Nama Orang Tua",
    "ijazah_kitab": "Ijazah Kitab",
    "ijazah_amaliah": "Ijazah Amaliah",
    "ijazah_nama_dalam": "Ijazah Nama Dalam",
    "ketua": "Ketua",
    "jabatan": "Jabatan",
    "judul": "Judul",
    "tanggal": "Tanggal",
    "waktu": "Waktu",
    "lokasi": "Lokasi",
    "deskripsi": "Deskripsi",
    "jumlah_jamaah": "Jumlah Jamaah",
    "kota": "Kota"
}

DEFAULT_COLUMNS = {
    "jamaah": ["id", "nama", "nik", "gender", "tempat_lahir", "tanggal_lahir", "alamat", "cabang", "no_hp", "nama_ortu", "ijazah_kitab", "ijazah_amaliah", "ijazah_nama_dalam"],
    "cabang": ["id_cabang", "kota", "alamat", "ketua", "no_hp"],
    "guru": ["id_guru", "nama", "cabang_nama", "jumlah_jamaah"],
    "pengurus": ["id_pengurus", "nama", "jabatan", "cabang_nama", "alamat", "no_hp"],
    "agenda": ["judul", "tanggal", "waktu", "lokasi", "deskripsi"],
}

@api_router.get("/export-options/cabang")
async def get_export_cabang_options():
    """ Helper API untuk Frontend menampilkan Nama Kota pada Checkbox / Select Cabang """
    docs = await db.cabang.find().sort("kota", 1).to_list(1000)
    return [{"id": str(d["_id"]), "nama": d.get("kota") or d.get("nama") or "Cabang Tanpa Nama"} for d in docs]

async def build_rows(entity: str, filters: dict):
    # Load dictionary cabang: id_string -> nama_kota
    cabang_docs = await db.cabang.find().to_list(1000)
    cabang_map = {}
    for c in cabang_docs:
        c_id = str(c["_id"])
        cabang_map[c_id] = c.get("kota") or c.get("nama") or "-"

    docs = await db[entity].find(filters).to_list(100000)
    rows = []
    
    for i, d in enumerate(docs, 1):
        d = serialize(d)
        d[f"id_{entity}"] = d.get(f"id_{entity}") or d.get("id") or f"{entity[:3].upper()}-{i:04d}"
        
        raw_c = str(d.get("cabang_id") or d.get("cabang") or "")
        nama_kota = cabang_map.get(raw_c, d.get("cabang_nama") or d.get("cabang") or "-")
        
        d["cabang_nama"] = nama_kota
        d["cabang"] = nama_kota
        d["id_cabang"] = nama_kota
        
        rows.append(d)
        
    return rows

@api_router.get("/export/{entity}")
async def export_data(entity: str, 
                      format: str = Query("xlsx"),
                      cabang: Optional[str] = Query(None),
                      cabang_id: Optional[str] = Query(None),
                      gender: Optional[str] = Query(None),
                      columns: Optional[str] = Query(None),
                      user: dict = Depends(get_current_user)):
    
    if entity not in DEFAULT_COLUMNS:
        raise HTTPException(status_code=400, detail="Entitas tidak valid")
    
    filters = {}
    valid_cabang = cabang or cabang_id
    if valid_cabang:
        c_str = str(valid_cabang).strip()
        if c_str.lower() not in ["all", "", "null", "undefined", "none"]:
            or_conds = [
                {"cabang_id": c_str},
                {"cabang": c_str}
            ]
            if ObjectId.is_valid(c_str):
                or_conds.append({"cabang_id": ObjectId(c_str)})
                or_conds.append({"_id": ObjectId(c_str)})
            filters["$or"] = or_conds

    if gender:
        g_str = str(gender).strip()
        if g_str.lower() not in ["all", "", "null", "undefined", "none"]:
            filters["gender"] = {"$regex": f"^{g_str}$", "$options": "i"}

    rows = await build_rows(entity, filters)

    if columns and columns.strip():
        req_keys = [c.strip() for c in columns.split(",") if c.strip()]
        active_keys = req_keys if req_keys else DEFAULT_COLUMNS[entity]
    else:
        active_keys = DEFAULT_COLUMNS[entity]

    headers = [COLUMN_TITLE_MAP.get(k, k.replace("_", " ").title()) for k in active_keys]

    await log_action(user, "EXPORT", entity, f"Export {format} ({len(rows)} baris)")

    if format == "xlsx":
        df_data = []
        for r in rows:
            row_dict = {}
            for k, header in zip(active_keys, headers):
                val = r.get(k)
                if val is None or val == "":
                    if k in ("nik", "no_ktp"):
                        val = r.get("nik") or r.get("no_ktp") or ""
                    elif k in ("nama_ortu", "nama_orang_tua"):
                        val = r.get("nama_ortu") or r.get("nama_orang_tua") or ""
                    elif k in ("cabang", "cabang_nama", "id_cabang"):
                        val = r.get("cabang_nama") or r.get("cabang") or r.get("cabang_id") or ""
                    elif k in ("id", f"id_{entity}"):
                        val = r.get(f"id_{entity}") or r.get("id") or ""

                if isinstance(val, list):
                    val = ", ".join(map(str, val))
                row_dict[header] = str(val) if val is not None else ""
            df_data.append(row_dict)

        df = pd.DataFrame(df_data, columns=headers)
        
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            df.to_excel(w, index=False, sheet_name=entity.capitalize())
        buf.seek(0)
        
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={entity}.xlsx"}
        )

    settings = await db.settings.find_one({"key": "yayasan"}) or {}
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], textColor=colors.HexColor("#0F766E"), fontSize=16)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], textColor=colors.HexColor("#C5A059"), fontSize=10, alignment=1)
    
    elems = [
        Paragraph(settings.get("nama", "Yayasan Raudhatul Jannah"), title_style),
        Paragraph("Majelis Dzikir dan Sholawat Raudhatul Jannah", sub_style),
        Spacer(1, 6*mm),
        Paragraph(f"Laporan Data {entity.capitalize()}", ParagraphStyle("h", parent=styles["Heading2"])),
        Spacer(1, 4*mm)
    ]
    
    table_data = [headers]
    for r in rows:
        row_vals = []
        for k in active_keys:
            val = r.get(k)
            if val is None or val == "":
                if k in ("nik", "no_ktp"):
                    val = r.get("nik") or r.get("no_ktp") or ""
                elif k in ("nama_ortu", "nama_orang_tua"):
                    val = r.get("nama_ortu") or r.get("nama_orang_tua") or ""
                elif k in ("cabang", "cabang_nama", "id_cabang"):
                    val = r.get("cabang_nama") or r.get("cabang") or ""
                elif k in ("id", f"id_{entity}"):
                    val = r.get(f"id_{entity}") or r.get("id") or ""

            if isinstance(val, list):
                val = ", ".join(map(str, val))
            row_vals.append(str(val if val is not None else ""))
        table_data.append(row_vals)

    t = Table(table_data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#D4AF37")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F7F7")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elems.append(t)
    elems.append(Spacer(1, 8*mm))
    elems.append(Paragraph(f"Dicetak: {datetime.now().strftime('%d %B %Y %H:%M')} | Total: {len(rows)} data",
                           ParagraphStyle("f", parent=styles["Normal"], fontSize=8, textColor=colors.grey)))
    doc.build(elems)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={entity}.pdf"})

# ------------------------------------------------------------------ startup & static mounts
app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(CORSMiddleware, allow_credentials=False,
                   allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        await db.users.insert_one({
            "username": "superadmin", "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD), "name": "Super Administrator",
            "role": "super_admin", "status": "active", "created_at": now_iso()})
        logger.info("Seeded super admin")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL.lower()},
                                  {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
    from seed import seed_all
    await seed_all(db, hash_password, now_iso)

@app.on_event("shutdown")
async def shutdown():
    client.close()