from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
import os

def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

def require_min_length(name: str, min_length: int) -> str:
    value = require_env(name)

    if len(value) < min_length:
        raise RuntimeError(
            f"{name} must be at least {min_length} characters long."
        )

    return value

import os
import io
import json
from PIL import Image
import logging
import asyncio
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from typing import List, Optional, Any, Dict, Annotated
import certifi


from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File
from fastapi.responses import JSONResponse
import shutil
import uuid
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict, EmailStr
from bson import ObjectId
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from access_control import (
    get_data_scope,
    is_branch_scoped,
    require_branch_assignment,
    require_official_role,
    require_super_admin as require_super,
    require_write_access as require_write,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

        response.headers["Content-Security-Policy"] = (
    "default-src 'self'; "
    "img-src 'self' data: https:; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "connect-src 'self' http://localhost:8000 ws://localhost:8000;"
)
        
        return response

# ------------------------------------------------------------------ config
mongo_url = require_env("MONGO_URL")
db_name = require_env("DB_NAME")
JWT_SECRET = require_min_length("JWT_SECRET", 32)

client = AsyncIOMotorClient(
    mongo_url,
    # Atlas requires TLS. certifi supplies a current CA bundle independently
    # from the operating-system certificate store.
    tls=True,
    tlsCAFile=certifi.where(),
    connectTimeoutMS=10000,
    serverSelectionTimeoutMS=20000,
)

db = client[db_name]

JWT_ALGORITHM = "HS256"

ADMIN_EMAIL = require_env("ADMIN_EMAIL")
ADMIN_PASSWORD = require_env("ADMIN_PASSWORD")

# Allowed CORS Origins
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000"
    ).split(",")
    if origin.strip()
]

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv(
        "ALLOWED_HOSTS",
        "localhost,127.0.0.1"
    ).split(",")
    if host.strip()
]

# Direktori Penyimpanan Upload Gambar
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

logger.info("Allowed Origins: %s", ALLOWED_ORIGINS)

app = FastAPI(title="Yayasan Raudhatul Jannah API")

app.mount(
    "/uploads",
    StaticFiles(
        directory=UPLOAD_DIR,
        check_dir=True,
    ),
    name="uploads",
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler,
)
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
        serialized_user = serialize(user)
        require_official_role(serialized_user)
        return serialized_user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

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
@limiter.limit("5/minute")
async def login(request: Request, data: LoginInput):
    email = data.email.strip().lower()
    user = await db.users.find_one({"$or": [{"email": email}, {"username": data.email.strip()}]})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    if user.get("status", "active") != "active":
        raise HTTPException(status_code=403, detail="Akun tidak aktif")
    role = require_official_role(user)
    token = create_access_token(str(user["_id"]), role)
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


# ------------------------------------------------------------------ user management
@api_router.get("/users")
async def list_users(user: dict = Depends(get_current_user)):
    require_super(user)
    docs = await db.users.find().sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(get_current_user)):
    require_super(user)
    require_official_role({"role": data.role})
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
    if data.role is not None:
        require_official_role({"role": data.role})
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
        # Generate ID otomatis
        if collection == "jamaah":
            last = await db[collection].find_one(
                {"id_jamaah": {"$exists": True}},
                sort=[("id_jamaah", -1)]
            )

            if last and last.get("id_jamaah"):
                nomor = int(last["id_jamaah"].split("-")[1]) + 1
            else:
                nomor = 1

            payload["id_jamaah"] = f"JMH-{nomor:04d}"
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

for _n, _c in [("cabang", "cabang"), ("pengumuman", "pengumuman")]:
    make_crud(_n, _c)


# ------------------------------------------------ global read + branch-scoped write CRUD
async def valid_branch_scope(user: dict) -> Optional[Dict[str, str]]:
    """Validate branch-scoped users and return their mandatory branch filter."""
    if not is_branch_scoped(user):
        return None

    require_branch_assignment(user)
    cabang_id = user["cabang_id"]
    if not ObjectId.is_valid(cabang_id):
        raise HTTPException(status_code=403, detail="Assignment cabang tidak valid.")

    assigned_branch = await db.cabang.find_one(
        {"_id": ObjectId(cabang_id)}, {"_id": 1}
    )
    if not assigned_branch:
        raise HTTPException(status_code=403, detail="Assignment cabang tidak valid.")
    return {"cabang_id": str(cabang_id)}


def make_global_read_branch_write_crud(name: str, collection: str):
    @api_router.get(f"/{name}")
    async def _list(user: dict = Depends(get_current_user)):
        await valid_branch_scope(user)
        docs = await db[collection].find().sort("created_at", -1).to_list(5000)
        return [serialize(d) for d in docs]

    @api_router.get(f"/{name}/{{item_id}}")
    async def _get(item_id: str, user: dict = Depends(get_current_user)):
        await valid_branch_scope(user)
        doc = await db[collection].find_one({"_id": ObjectId(item_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        return serialize(doc)

    @api_router.post(f"/{name}")
    async def _create(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
        require_write(user)
        scope = await valid_branch_scope(user)
        payload.pop("id", None)
        payload.pop("_id", None)
        if scope is not None:
            payload["cabang_id"] = scope["cabang_id"]
        payload["created_at"] = now_iso()
        payload["updated_at"] = now_iso()
        result = await db[collection].insert_one(payload)
        await log_action(
            user, "CREATE", collection, payload.get("nama") or payload.get("judul") or ""
        )
        return serialize(await db[collection].find_one({"_id": result.inserted_id}))

    @api_router.put(f"/{name}/{{item_id}}")
    async def _update(
        item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)
    ):
        require_write(user)
        scope = await valid_branch_scope(user)
        payload.pop("id", None)
        payload.pop("_id", None)
        if scope is not None:
            payload.pop("cabang_id", None)
        payload["updated_at"] = now_iso()
        target_query = {"_id": ObjectId(item_id), **(scope or {})}
        result = await db[collection].update_one(target_query, {"$set": payload})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        await log_action(user, "UPDATE", collection, item_id)
        return serialize(await db[collection].find_one(target_query))

    @api_router.delete(f"/{name}/{{item_id}}")
    async def _delete(item_id: str, user: dict = Depends(get_current_user)):
        require_write(user)
        scope = await valid_branch_scope(user)
        result = await db[collection].delete_one(
            {"_id": ObjectId(item_id), **(scope or {})}
        )
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        await log_action(user, "DELETE", collection, item_id)
        return {"message": "Data dihapus"}

    @api_router.post(f"/{name}/bulk-delete")
    async def _bulk_delete(
        payload: Dict[str, Any], user: dict = Depends(get_current_user)
    ):
        require_write(user)
        scope = await valid_branch_scope(user)
        ids = [ObjectId(i) for i in payload.get("ids", [])]
        target_query = {"_id": {"$in": ids}, **(scope or {})}
        if scope is not None:
            matched = await db[collection].count_documents(target_query)
            if matched != len(set(ids)):
                raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        await db[collection].delete_many(target_query)
        await log_action(user, "DELETE", collection, f"Bulk hapus {len(ids)} data")
        return {"message": f"{len(ids)} data dihapus"}


for _n, _c in [("agenda", "agenda"), ("galeri", "galeri")]:
    make_global_read_branch_write_crud(_n, _c)

# ------------------------------------------------------------------ jamaah CRUD with branch scope
def jamaah_data_scope(user: dict) -> Optional[Dict[str, str]]:
    require_branch_assignment(user)
    return get_data_scope(user)


def jamaah_query(scope: Optional[Dict[str, str]], query: Optional[dict] = None) -> dict:
    scoped_query = dict(query or {})
    if scope is not None:
        scoped_query.update(scope)
    return scoped_query


@api_router.get("/jamaah")
async def list_jamaah(user: dict = Depends(get_current_user)):
    scope = jamaah_data_scope(user)
    docs = await db.jamaah.find(jamaah_query(scope)).sort("created_at", -1).to_list(5000)
    return [serialize(d) for d in docs]


@api_router.get("/jamaah/{item_id}")
async def get_jamaah(item_id: str, user: dict = Depends(get_current_user)):
    scope = jamaah_data_scope(user)
    doc = await db.jamaah.find_one(jamaah_query(scope, {"_id": ObjectId(item_id)}))
    if not doc:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return serialize(doc)


@api_router.post("/jamaah")
async def create_jamaah(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = jamaah_data_scope(user)
    require_write(user)
    payload.pop("id", None)
    if scope is not None:
        payload["cabang_id"] = scope["cabang_id"]
    payload["created_at"] = now_iso()
    payload["updated_at"] = now_iso()

    last = await db.jamaah.find_one(
        {"id_jamaah": {"$exists": True}},
        sort=[("id_jamaah", -1)],
    )
    if last and last.get("id_jamaah"):
        nomor = int(last["id_jamaah"].split("-")[1]) + 1
    else:
        nomor = 1
    payload["id_jamaah"] = f"JMH-{nomor:04d}"

    res = await db.jamaah.insert_one(payload)
    await log_action(user, "CREATE", "jamaah", payload.get("nama", ""))
    return serialize(await db.jamaah.find_one({"_id": res.inserted_id}))


@api_router.put("/jamaah/{item_id}")
async def update_jamaah(item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = jamaah_data_scope(user)
    require_write(user)
    payload.pop("id", None)
    payload.pop("_id", None)
    if scope is not None:
        payload["cabang_id"] = scope["cabang_id"]
    payload["updated_at"] = now_iso()

    result = await db.jamaah.update_one(
        jamaah_query(scope, {"_id": ObjectId(item_id)}),
        {"$set": payload},
    )
    if scope is not None and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await log_action(user, "UPDATE", "jamaah", item_id)
    return serialize(await db.jamaah.find_one({"_id": ObjectId(item_id)}))


@api_router.delete("/jamaah/{item_id}")
async def delete_jamaah(item_id: str, user: dict = Depends(get_current_user)):
    scope = jamaah_data_scope(user)
    require_write(user)
    result = await db.jamaah.delete_one(jamaah_query(scope, {"_id": ObjectId(item_id)}))
    if scope is not None and result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await log_action(user, "DELETE", "jamaah", item_id)
    return {"message": "Data dihapus"}


@api_router.post("/jamaah/bulk-delete")
async def bulk_delete_jamaah(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = jamaah_data_scope(user)
    require_write(user)
    ids = [ObjectId(i) for i in payload.get("ids", [])]
    target_query = jamaah_query(scope, {"_id": {"$in": ids}})

    if scope is not None:
        matched = await db.jamaah.count_documents(target_query)
        if matched != len(set(ids)):
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")

    await db.jamaah.delete_many(target_query)
    await log_action(user, "DELETE", "jamaah", f"Bulk hapus {len(ids)} data")
    return {"message": f"{len(ids)} data dihapus"}


# ------------------------------------------------------------------ pengurus CRUD with branch scope
def pengurus_data_scope(user: dict) -> Optional[Dict[str, str]]:
    require_branch_assignment(user)
    return get_data_scope(user)


def pengurus_query(scope: Optional[Dict[str, str]], query: Optional[dict] = None) -> dict:
    scoped_query = dict(query or {})
    if scope is not None:
        scoped_query.update(scope)
    return scoped_query


@api_router.get("/pengurus")
async def list_pengurus(user: dict = Depends(get_current_user)):
    scope = pengurus_data_scope(user)
    docs = await db.pengurus.find(pengurus_query(scope)).sort("created_at", -1).to_list(5000)
    return [serialize(d) for d in docs]


@api_router.get("/pengurus/{item_id}")
async def get_pengurus(item_id: str, user: dict = Depends(get_current_user)):
    scope = pengurus_data_scope(user)
    doc = await db.pengurus.find_one(pengurus_query(scope, {"_id": ObjectId(item_id)}))
    if not doc:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return serialize(doc)


@api_router.post("/pengurus")
async def create_pengurus(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = pengurus_data_scope(user)
    require_write(user)
    payload.pop("id", None)
    if scope is not None:
        payload["cabang_id"] = scope["cabang_id"]
    payload["created_at"] = now_iso()
    payload["updated_at"] = now_iso()
    res = await db.pengurus.insert_one(payload)
    await log_action(user, "CREATE", "pengurus", payload.get("nama", ""))
    return serialize(await db.pengurus.find_one({"_id": res.inserted_id}))


@api_router.put("/pengurus/{item_id}")
async def update_pengurus(item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = pengurus_data_scope(user)
    require_write(user)
    payload.pop("id", None)
    payload.pop("_id", None)
    if scope is not None:
        payload.pop("cabang_id", None)
    payload["updated_at"] = now_iso()
    result = await db.pengurus.update_one(
        pengurus_query(scope, {"_id": ObjectId(item_id)}),
        {"$set": payload},
    )
    if scope is not None and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await log_action(user, "UPDATE", "pengurus", item_id)
    return serialize(await db.pengurus.find_one({"_id": ObjectId(item_id)}))


@api_router.delete("/pengurus/{item_id}")
async def delete_pengurus(item_id: str, user: dict = Depends(get_current_user)):
    scope = pengurus_data_scope(user)
    require_write(user)
    result = await db.pengurus.delete_one(pengurus_query(scope, {"_id": ObjectId(item_id)}))
    if scope is not None and result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await log_action(user, "DELETE", "pengurus", item_id)
    return {"message": "Data dihapus"}


@api_router.post("/pengurus/bulk-delete")
async def bulk_delete_pengurus(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = pengurus_data_scope(user)
    require_write(user)
    ids = [ObjectId(i) for i in payload.get("ids", [])]
    target_query = pengurus_query(scope, {"_id": {"$in": ids}})
    if scope is not None:
        matched = await db.pengurus.count_documents(target_query)
        if matched != len(set(ids)):
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await db.pengurus.delete_many(target_query)
    await log_action(user, "DELETE", "pengurus", f"Bulk hapus {len(ids)} data")
    return {"message": f"{len(ids)} data dihapus"}

# ------------------------------------------------------------------ guru
async def _enrich_guru(docs, scope: Optional[Dict[str, str]] = None):
    # Ambil semua cabang sekali
    cabang_docs = await db.cabang.find(
        {},
        {"kota": 1}
    ).to_list(1000)

    cabang_map = {
        str(c["_id"]): c.get("kota", "")
        for c in cabang_docs
    }

    # Hitung jumlah jamaah per cabang SEKALI SAJA
    pipeline = [
        {
            "$group": {
                "_id": "$cabang_id",
                "total": {"$sum": 1}
            }
        }
    ]

    jamaah_counts = await db.jamaah.aggregate(pipeline).to_list(10000)

    jamaah_map = {
        str(item["_id"]): item["total"]
        for item in jamaah_counts
    }

    out = []

    for doc in docs:
        d = serialize(doc)

        # Mendukung data lama maupun baru
        cids = d.get("cabang_ids") or (
            [d["cabang_id"]] if d.get("cabang_id") else []
        )

        if scope is not None:
            cids = [cid for cid in cids if cid == scope["cabang_id"]]

        d["cabang_ids"] = cids

        d["cabang_nama"] = ", ".join(
            cabang_map.get(cid, "")
            for cid in cids
            if cabang_map.get(cid)
        )

        d["jumlah_jamaah"] = sum(
            jamaah_map.get(cid, 0)
            for cid in cids
        )

        out.append(d)

    return out

def guru_data_scope(user: dict) -> Optional[Dict[str, str]]:
    require_branch_assignment(user)
    return get_data_scope(user)


def guru_query(scope: Optional[Dict[str, str]], query: Optional[dict] = None) -> dict:
    scoped_query = dict(query or {})
    if scope is not None:
        cabang_id = scope["cabang_id"]
        scoped_query["$or"] = [
            {"cabang_id": cabang_id},
            {"cabang_ids": cabang_id},
        ]
    return scoped_query

@api_router.get("/guru")
async def list_guru(user: dict = Depends(get_current_user)):
    scope = guru_data_scope(user)
    cursor = db.guru.find(guru_query(scope))
    docs = await cursor.sort("created_at", -1).to_list(5000)
    result = await _enrich_guru(docs, scope)
    return result

@api_router.get("/guru/{item_id}")
async def get_guru(item_id: str, user: dict = Depends(get_current_user)):
    scope = guru_data_scope(user)
    doc = await db.guru.find_one(guru_query(scope, {"_id": ObjectId(item_id)}))
    if not doc:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    return (await _enrich_guru([doc], scope))[0]

@api_router.post("/guru")
async def create_guru(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = guru_data_scope(user)
    require_write(user)
    for k in ("id", "cabang_nama", "jumlah_jamaah"):
        payload.pop(k, None)
    if scope is not None:
        payload.pop("cabang_id", None)
        payload["cabang_ids"] = [scope["cabang_id"]]
    payload["created_at"] = now_iso()
    payload["updated_at"] = now_iso()
    res = await db.guru.insert_one(payload)
    await log_action(user, "CREATE", "guru", payload.get("nama", ""))
    return (await _enrich_guru([await db.guru.find_one({"_id": res.inserted_id})], scope))[0]

@api_router.put("/guru/{item_id}")
async def update_guru(item_id: str, payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = guru_data_scope(user)
    require_write(user)
    for k in ("id", "_id", "cabang_nama", "jumlah_jamaah"):
        payload.pop(k, None)
    target_query = guru_query(scope, {"_id": ObjectId(item_id)})
    if scope is not None:
        existing = await db.guru.find_one(target_query)
        if not existing:
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
        payload.pop("cabang_id", None)
        payload.pop("cabang_ids", None)
    payload["updated_at"] = now_iso()
    await db.guru.update_one(target_query, {"$set": payload})
    await log_action(user, "UPDATE", "guru", item_id)
    doc = await db.guru.find_one({"_id": ObjectId(item_id)})
    return (await _enrich_guru([doc], scope))[0]

@api_router.delete("/guru/{item_id}")
async def delete_guru(item_id: str, user: dict = Depends(get_current_user)):
    scope = guru_data_scope(user)
    require_write(user)
    result = await db.guru.delete_one(guru_query(scope, {"_id": ObjectId(item_id)}))
    if scope is not None and result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await log_action(user, "DELETE", "guru", item_id)
    return {"message": "Data dihapus"}

@api_router.post("/guru/bulk-delete")
async def bulk_delete_guru(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    scope = guru_data_scope(user)
    require_write(user)
    ids = [ObjectId(i) for i in payload.get("ids", [])]
    target_query = guru_query(scope, {"_id": {"$in": ids}})
    if scope is not None:
        matched = await db.guru.count_documents(target_query)
        if matched != len(set(ids)):
            raise HTTPException(status_code=404, detail="Data tidak ditemukan")
    await db.guru.delete_many(target_query)
    await log_action(user, "DELETE", "guru", f"Bulk hapus {len(ids)} data")
    return {"message": f"{len(ids)} data dihapus"}

# ------------------------------------------------------------------ public endpoints
PUBLIC_SETTINGS_FIELDS = (
    "nama",
    "nama_majelis",
    "alamat",
    "email",
    "telepon",
    "whatsapp",
    "instagram",
    "facebook",
    "youtube",
)

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
    if not doc:
        return {}

    return {
        field: doc[field]
        for field in PUBLIC_SETTINGS_FIELDS
        if field in doc
    }

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
    require_super(user)
    docs = await db.messages.find().sort("created_at", -1).to_list(1000)
    return [serialize(d) for d in docs]

@api_router.delete("/messages/{mid}")
async def delete_message(mid: str, user: dict = Depends(get_current_user)):
    require_super(user)
    await db.messages.delete_one({"_id": ObjectId(mid)})
    return {"message": "Pesan dihapus"}

# ------------------------------------------------------------------ dashboard
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    scope = await valid_branch_scope(user)
    jamaah_filter = jamaah_query(scope)
    guru_filter = guru_query(scope)
    pengurus_filter = dict(scope or {})

    total_jamaah = await db.jamaah.count_documents(jamaah_filter)
    now = datetime.now(timezone.utc).isoformat()
    active_events = await db.agenda.count_documents({"tanggal": {"$gte": now[:10]}})
    cabang_filter = (
        {"_id": ObjectId(scope["cabang_id"])} if scope is not None else {}
    )
    cabang_list = await db.cabang.find(cabang_filter).to_list(1000)
    per_cabang = []
    for c in cabang_list:
        cnt = await db.jamaah.count_documents({"cabang_id": str(c["_id"])})
        per_cabang.append({"kota": c.get("kota", "-"), "jamaah": cnt})
    male = await db.jamaah.count_documents(
        jamaah_query(scope, {"gender": "Laki-laki"})
    )
    female = await db.jamaah.count_documents(
        jamaah_query(scope, {"gender": "Perempuan"})
    )
    upcoming = await db.agenda.find({"tanggal": {"$gte": now[:10]}}).sort("tanggal", 1).to_list(5)
    return {
        "total_cabang": await db.cabang.count_documents(cabang_filter),
        "total_guru": await db.guru.count_documents(guru_filter),
        "total_pengurus": await db.pengurus.count_documents(pengurus_filter),
        "total_jamaah": total_jamaah,
        "active_events": active_events,
        "per_cabang": per_cabang,
        "gender": {"male": male, "female": female},
        "upcoming_agenda": [serialize(a) for a in upcoming],
    }

# ------------------------------------------------------------------ audit log
@api_router.get("/audit-logs")
async def audit_logs(user: dict = Depends(get_current_user)):
    require_super(user)
    docs = await db.audit_logs.find().sort("timestamp", -1).to_list(1000)
    return [serialize(d) for d in docs]

# ------------------------------------------------------------------ settings
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    require_super(user)
    doc = await db.settings.find_one({"key": "yayasan"})
    return serialize(doc) if doc else {}

@api_router.put("/settings")
async def update_settings(payload: Dict[str, Any], user: dict = Depends(get_current_user)):
    require_super(user)
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
    "kota": "Kota",
    "target": "Target",
    "kategori": "Kategori",
    "type": "Tipe",
    "url": "URL",
    "published": "Dipublikasikan",
    "status": "Status",
}

# Explicit export whitelists. Never derive exportable columns from MongoDB documents.
DEFAULT_COLUMNS = {
    "jamaah": ["id", "nama", "nik", "gender", "tempat_lahir", "tanggal_lahir", "alamat", "cabang", "no_hp", "nama_ortu", "ijazah_kitab", "ijazah_amaliah", "ijazah_nama_dalam"],
    "cabang": ["id_cabang", "kota", "alamat", "ketua", "no_hp"],
    "guru": ["id_guru", "nama", "cabang_nama", "jumlah_jamaah"],
    "pengurus": ["id_pengurus", "nama", "jabatan", "cabang_nama", "alamat", "no_hp"],
    "agenda": ["judul", "tanggal", "waktu", "lokasi", "deskripsi"],
    "galeri": ["judul", "kategori", "type", "url", "published"],
    "pengumuman": ["judul", "tanggal", "deskripsi", "status"],
}

EXPORT_FIELDS = {
    "jamaah": ["id", "id_jamaah", "nama", "nik", "no_ktp", "gender", "tempat_lahir", "tanggal_lahir", "alamat", "cabang", "cabang_nama", "no_hp", "nama_ortu", "nama_orang_tua", "ijazah_kitab", "ijazah_amaliah", "ijazah_nama_dalam"],
    "cabang": ["id_cabang", "kota", "alamat", "ketua", "no_hp"],
    "guru": ["id_guru", "nama", "cabang_nama", "jumlah_jamaah", "no_hp", "alamat", "ijazah_kitab", "ijazah_amaliah", "ijazah_nama_dalam"],
    "pengurus": ["id_pengurus", "nama", "jabatan", "cabang_nama", "alamat", "no_hp"],
    "agenda": ["judul", "tanggal", "waktu", "lokasi", "deskripsi", "target", "cabang_nama"],
    "galeri": ["judul", "kategori", "type", "url", "published", "cabang_nama"],
    "pengumuman": ["judul", "tanggal", "deskripsi", "status", "cabang_nama"],
}

EXPORT_PRESETS = {
    "jamaah": [
        {"key": "default", "label": "Default", "fields": DEFAULT_COLUMNS["jamaah"]},
        {"key": "data_dasar", "label": "Data Dasar", "fields": ["nama", "gender", "tempat_lahir", "tanggal_lahir", "alamat", "no_hp"]},
        {"key": "data_keanggotaan", "label": "Data Keanggotaan", "fields": ["id_jamaah", "nama", "cabang_nama", "ijazah_kitab", "ijazah_amaliah"]},
        {"key": "usulan_nama_dalam", "label": "Usulan Nama Dalam", "fields": ["gender", "nama", "nama_orang_tua", "ijazah_nama_dalam"]},
    ]
}


def export_presets(entity: str) -> List[dict]:
    presets = EXPORT_PRESETS.get(entity)
    if presets:
        return presets
    return [{"key": "default", "label": "Default", "fields": DEFAULT_COLUMNS[entity]}]


def parse_export_fields(raw_fields: Optional[str], entity: str, preset: Optional[str]) -> List[str]:
    requested = raw_fields.strip() if raw_fields else ""
    if requested:
        try:
            parsed = json.loads(requested)
            keys = parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            keys = requested.split(",")
        keys = [str(key).strip() for key in keys if str(key).strip()]
    elif preset:
        matched = next((item for item in export_presets(entity) if item["key"] == preset), None)
        if not matched:
            raise HTTPException(status_code=400, detail="Preset export tidak valid")
        keys = list(matched["fields"])
    else:
        keys = list(DEFAULT_COLUMNS[entity])

    if not keys:
        raise HTTPException(status_code=400, detail="Kolom export tidak boleh kosong")
    illegal = [key for key in keys if key not in EXPORT_FIELDS[entity]]
    if illegal:
        raise HTTPException(status_code=400, detail=f"Kolom export tidak valid: {', '.join(illegal)}")
    return keys


def export_value(row: dict, key: str, entity: str) -> str:
    value = row.get(key)
    if value is None or value == "":
        if key in ("nik", "no_ktp"):
            value = row.get("nik") or row.get("no_ktp") or ""
        elif key in ("nama_ortu", "nama_orang_tua"):
            value = row.get("nama_orang_tua") or row.get("nama_ortu") or ""
        elif key in ("cabang", "cabang_nama", "id_cabang"):
            value = row.get("cabang_nama") or row.get("cabang") or ""
        elif key in ("id", f"id_{entity}"):
            value = row.get(f"id_{entity}") or row.get("id") or ""
    if isinstance(value, list):
        value = ", ".join(map(str, value))
    return str(value) if value is not None else ""


@api_router.get("/export/fields/{entity}")
async def get_export_fields(entity: str, user: dict = Depends(get_current_user)):
    require_official_role(user)
    if entity not in DEFAULT_COLUMNS:
        raise HTTPException(status_code=400, detail="Entitas tidak valid")
    defaults = set(DEFAULT_COLUMNS[entity])
    return {
        "resource": entity,
        "fields": [
            {"key": key, "label": COLUMN_TITLE_MAP.get(key, key.replace("_", " ").title()), "default": key in defaults}
            for key in EXPORT_FIELDS[entity]
        ],
        "presets": export_presets(entity),
    }


@api_router.get("/export-options/cabang")
async def get_export_cabang_options(user: dict = Depends(get_current_user)):
    """ Helper API untuk Frontend menampilkan Nama Kota pada Checkbox / Select Cabang """
    scope = await valid_branch_scope(user)
    query = {"_id": ObjectId(scope["cabang_id"])} if scope is not None else {}
    docs = await db.cabang.find(query).sort("kota", 1).to_list(1000)
    return [{"id": str(d["_id"]), "nama": d.get("kota") or d.get("nama") or "Cabang Tanpa Nama"} for d in docs]

async def build_rows(entity: str, filters: dict):
    # Load dictionary cabang: id_string -> nama_kota
    cabang_docs = await db.cabang.find().to_list(1000)
    cabang_map = {}
    for c in cabang_docs:
        c_id = str(c["_id"])
        cabang_map[c_id] = c.get("kota") or c.get("nama") or "-"

    guru_docs = await db.guru.find().to_list(1000) if entity == "jamaah" else []
    guru_map = {str(g["_id"]): g.get("nama") or "-" for g in guru_docs}
    cabang_guru_map = {
        str(c["_id"]): str(c.get("guru_id") or "") for c in cabang_docs
    }

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
        guru_id = str(d.get("guru_id") or cabang_guru_map.get(raw_c) or "")
        d["guru_pembimbing_nama"] = guru_map.get(guru_id, d.get("guru_pembimbing_nama") or "-")
        
        rows.append(d)
        
    return rows


async def export_query(entity: str, user: dict, requested_branch: Optional[str], gender: Optional[str]) -> dict:
    scope = await valid_branch_scope(user)
    branch_owned = {"jamaah", "guru", "pengurus", "pengumuman"}

    if entity == "guru":
        filters = guru_query(scope) if scope is not None else {}
    elif entity in branch_owned:
        filters = dict(scope or {})
    elif entity == "cabang" and scope is not None:
        filters = {"_id": ObjectId(scope["cabang_id"])}
    else:
        filters = {}

    # A client filter may narrow global scope, but never replace a mandatory branch scope.
    can_apply_branch_filter = scope is None
    if requested_branch and can_apply_branch_filter:
        c_str = str(requested_branch).strip()
        if c_str.lower() not in {"all", "", "null", "undefined", "none"}:
            conditions = [{"cabang_id": c_str}, {"cabang": c_str}]
            if ObjectId.is_valid(c_str):
                conditions.append({"cabang_id": ObjectId(c_str)})
                if entity == "cabang":
                    conditions.append({"_id": ObjectId(c_str)})
            filters = {"$and": [filters, {"$or": conditions}]} if filters else {"$or": conditions}

    if gender and entity == "jamaah":
        g_str = str(gender).strip()
        if g_str.lower() not in {"all", "", "null", "undefined", "none"}:
            gender_filter = {"gender": {"$regex": f"^{g_str}$", "$options": "i"}}
            filters = {"$and": [filters, gender_filter]} if filters else gender_filter
    return filters


def usulan_document_headers(rows: List[dict]) -> tuple[str, str]:
    branches = {row.get("cabang_nama") for row in rows if row.get("cabang_nama") not in (None, "", "-")}
    teachers = {row.get("guru_pembimbing_nama") for row in rows if row.get("guru_pembimbing_nama") not in (None, "", "-")}
    branch_label = next(iter(branches)) if len(branches) == 1 else "Semua Cabang"
    teacher_label = next(iter(teachers)) if len(teachers) == 1 else "Semua Guru Pembimbing"
    return branch_label, teacher_label

@api_router.get("/export/{entity}")
async def export_data(entity: str, 
                      format: str = Query("xlsx"),
                      cabang: Optional[str] = Query(None),
                      cabang_id: Optional[str] = Query(None),
                      gender: Optional[str] = Query(None),
                      columns: Optional[str] = Query(None),
                      fields: Optional[str] = None,
                      preset: Optional[str] = None,
                      user: dict = Depends(get_current_user)):
    
    if entity not in DEFAULT_COLUMNS:
        raise HTTPException(status_code=400, detail="Entitas tidak valid")
    
    if format not in {"xlsx", "pdf"}:
        raise HTTPException(status_code=400, detail="Format export tidak valid")
    filters = await export_query(entity, user, cabang or cabang_id, gender)
    rows = await build_rows(entity, filters)
    active_keys = parse_export_fields(fields or columns, entity, preset)
    headers = [COLUMN_TITLE_MAP.get(k, k.replace("_", " ").title()) for k in active_keys]
    is_usulan = entity == "jamaah" and preset == "usulan_nama_dalam"
    if is_usulan:
        usulan_labels = {"gender": "Gender", "nama": "Nama", "nama_orang_tua": "Nama Orang Tua", "ijazah_nama_dalam": "Ijazah Nama Dalam"}
        headers = [usulan_labels.get(key, COLUMN_TITLE_MAP.get(key, key.replace("_", " ").title())) for key in active_keys]
    document_title = f"USULAN NAMA DALAM ({datetime.now(timezone.utc).year})" if is_usulan else None
    branch_label, teacher_label = usulan_document_headers(rows) if is_usulan else (None, None)

    await log_action(user, "EXPORT", entity, f"Export {format} ({len(rows)} baris)")

    if format == "xlsx":
        df_data = [{header: export_value(row, key, entity) for key, header in zip(active_keys, headers)} for row in rows]

        df = pd.DataFrame(df_data, columns=headers)
        
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as w:
            start_row = 5 if is_usulan else 0
            df.to_excel(w, index=False, sheet_name=entity.capitalize(), startrow=start_row)
            if is_usulan:
                sheet = w.sheets[entity.capitalize()]
                sheet.cell(1, 1, document_title)
                sheet.cell(3, 1, "Cabang")
                sheet.cell(3, 2, branch_label)
                sheet.cell(4, 1, "Guru Pembimbing")
                sheet.cell(4, 2, teacher_label)
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
    
    if is_usulan:
        elems = [
            Paragraph(document_title, title_style), Spacer(1, 4*mm),
            Paragraph(f"Cabang : {branch_label}", styles["Normal"]),
            Paragraph(f"Guru Pembimbing : {teacher_label}", styles["Normal"]),
            Spacer(1, 4*mm),
        ]
    else:
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
            row_vals.append(export_value(r, k, entity))
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
@api_router.post("/upload/{folder}")
async def upload_file(
    folder: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    require_write(user)
    await valid_branch_scope(user)
    allowed = {"guru", "jamaah", "pengurus", "galeri", "sk"}

    if folder not in allowed:
        raise HTTPException(status_code=400, detail="Folder tidak valid")

    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="File harus berupa gambar."
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
        status_code=413,
        detail="Ukuran file maksimal 10 MB."
    )
    image_bytes = compress_and_convert_to_webp(image_bytes)

    filename = f"{uuid.uuid4().hex}.webp"

    save_dir = UPLOAD_DIR / folder
    save_dir.mkdir(parents=True, exist_ok=True)

    save_path = save_dir / filename

    with open(save_path, "wb") as f:
        f.write(image_bytes)

    return {
        "url": f"/uploads/{folder}/{filename}"
    }

app.include_router(api_router)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=[
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
],
    allow_headers=["*"],
)

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=ALLOWED_HOSTS,
)

app.add_middleware(SlowAPIMiddleware)

@app.on_event("startup")
async def startup():
    logger.info("Menghubungkan ke MongoDB...")

    max_retry = 10

    for attempt in range(1, max_retry + 1):
        try:
            await db.users.create_index("email", unique=True)

            # Guru
            await db.guru.create_index("id_guru", unique=True)
            await db.guru.create_index("cabang_ids")

            # Jamaah
            await db.jamaah.create_index("id_jamaah", unique=True)
            await db.jamaah.create_index("cabang_id")
            await db.jamaah.create_index("guru_id")

            # Cabang
            await db.cabang.create_index("kota")

            logger.info(
                f"Berhasil terhubung ke MongoDB (percobaan {attempt})"
            )
            break

        except Exception as e:
            logger.warning(
                f"Gagal koneksi MongoDB ({attempt}/{max_retry}): {e}"
            )

            if attempt == max_retry:
                logger.error("Tidak dapat terhubung ke MongoDB.")
                raise

            await asyncio.sleep(3)

    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})

    if not existing:
        await db.users.insert_one({
            "username": "superadmin",
            "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Super Administrator",
            "role": "super_admin",
            "status": "active",
            "created_at": now_iso(),
        })
        logger.info("Seeded super admin")

    from seed import demo_seed_enabled, seed_all
    if demo_seed_enabled():
        await seed_all(db, hash_password, now_iso)
        logger.info("Demo seed enabled and applied")
    else:
        logger.info("Demo seed disabled")

@app.on_event("shutdown")
async def shutdown():
    client.close()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
