import os
import io
import base64
from pathlib import Path

from PIL import Image
from pymongo import MongoClient
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
print("ROOT_DIR =", ROOT_DIR)
print("ENV =", ROOT_DIR / ".env")
print("ENV EXISTS =", (ROOT_DIR / ".env").exists())
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")
print("DB_NAME =", DB_NAME)

print("MONGO_URL =", MONGO_URL)
print("DB_NAME =", DB_NAME)
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

print("PING...")
client.admin.command("ping")
print("PING OK")

print("Collections:")
print(db.list_collection_names())

print("Jumlah guru:")
print(db.guru.count_documents({}))


UPLOAD_ROOT = ROOT_DIR / "uploads"


def save_base64_image(base64_string: str, folder: str):
    if not base64_string.startswith("data:image"):
        return base64_string

    header, data = base64_string.split(",", 1)

    image_bytes = base64.b64decode(data)

    image = Image.open(io.BytesIO(image_bytes))

    filename = os.urandom(16).hex() + ".webp"

    save_dir = UPLOAD_ROOT / folder
    save_dir.mkdir(parents=True, exist_ok=True)

    save_path = save_dir / filename

    image.save(save_path, "WEBP", quality=90)

    return f"/uploads/{folder}/{filename}"

def migrate_guru():
    total = 0

    for guru in db.guru.find():
        update = {}

        foto = guru.get("foto")
        if isinstance(foto, str) and foto.startswith("data:image"):
            update["foto"] = save_base64_image(foto, "guru")

        sk = guru.get("sk")
        if isinstance(sk, str) and sk.startswith("data:image"):
            update["sk"] = save_base64_image(sk, "sk")

        if update:
            db.guru.update_one(
                {"_id": guru["_id"]},
                {"$set": update}
            )

            total += 1
            print("Migrasi:", guru.get("nama"))

    print()
    print("Selesai.")
    print("Total data diubah:", total)


if __name__ == "__main__":
    migrate_guru()