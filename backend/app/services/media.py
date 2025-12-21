"""
Media storage service with local file storage.
Designed for easy swap to Cloudinary in production.
"""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image
from io import BytesIO
from fastapi import UploadFile, HTTPException

from app.core.config import settings


# Image size variants
IMAGE_SIZES = {
    "thumbnail": (320, 180),
    "medium": (640, 360),
    "large": (1280, 720),
}

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def get_upload_dir(folder: str) -> Path:
    """Get upload directory path, creating if needed."""
    base_dir = Path(settings.UPLOAD_DIR if hasattr(settings, 'UPLOAD_DIR') else "static/uploads")
    upload_dir = base_dir / folder
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def validate_image(file: UploadFile) -> None:
    """Validate uploaded image file."""
    # Check extension
    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Check content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")


def generate_image_variants(image: Image.Image, upload_dir: Path, base_name: str) -> dict:
    """Generate thumbnail, medium, and large variants of an image."""
    urls = {}

    for size_name, dimensions in IMAGE_SIZES.items():
        resized = image.copy()
        resized.thumbnail(dimensions, Image.Resampling.LANCZOS)

        filename = f"{base_name}_{size_name}.webp"
        filepath = upload_dir / filename
        resized.save(filepath, "WEBP", quality=85)

        urls[f"{size_name}_url"] = f"/static/uploads/{upload_dir.name}/{filename}"

    return urls


async def upload_image(file: UploadFile, folder: str) -> dict:
    """
    Upload an image and generate size variants.

    Returns dict with url, thumbnail_url, medium_url, large_url
    """
    validate_image(file)

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")

    # Open and process image
    try:
        image = Image.open(BytesIO(content))
        image = image.convert("RGB")  # Ensure RGB for WebP
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Generate unique filename
    file_id = str(uuid.uuid4()).replace("-", "")
    upload_dir = get_upload_dir(folder)

    # Save original as WebP
    original_filename = f"{file_id}_original.webp"
    original_path = upload_dir / original_filename
    image.save(original_path, "WEBP", quality=90)

    # Generate variants
    urls = generate_image_variants(image, upload_dir, file_id)
    urls["url"] = f"/static/uploads/{folder}/{original_filename}"

    return urls


def delete_image(url: str) -> bool:
    """Delete an image and all its variants."""
    if not url or not url.startswith("/static/uploads/"):
        return False

    # Extract folder and base filename
    parts = url.replace("/static/uploads/", "").split("/")
    if len(parts) != 2:
        return False

    folder, filename = parts
    base_name = filename.rsplit("_", 1)[0]  # Remove _original.webp

    upload_dir = get_upload_dir(folder)

    # Delete all variants
    deleted = False
    for suffix in ["original", "thumbnail", "medium", "large"]:
        filepath = upload_dir / f"{base_name}_{suffix}.webp"
        if filepath.exists():
            filepath.unlink()
            deleted = True

    return deleted
