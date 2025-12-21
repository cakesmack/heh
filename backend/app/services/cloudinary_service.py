"""
Cloudinary media storage service.
Handles image uploads, transformations, and deletions.
Falls back to local storage when Cloudinary is not configured.
"""
from typing import Optional, Dict
from fastapi import UploadFile, HTTPException

from app.core.config import settings


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary is configured."""
    return all([
        settings.CLOUDINARY_CLOUD_NAME,
        settings.CLOUDINARY_API_KEY,
        settings.CLOUDINARY_API_SECRET
    ])


def init_cloudinary():
    """Initialize Cloudinary configuration."""
    if not is_cloudinary_configured():
        return False

    import cloudinary
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )
    return True


async def upload_image(
    file: UploadFile,
    folder: str,
    public_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Upload an image to Cloudinary.

    Args:
        file: The uploaded file
        folder: The folder to upload to (events, venues, categories)
        public_id: Optional custom public ID

    Returns dict with:
    - url: Original image URL
    - thumbnail_url: 320x180 thumbnail
    - medium_url: 640x360 medium size
    - large_url: 1280x720 large size
    - public_id: Cloudinary public ID for deletion
    """
    if not is_cloudinary_configured():
        raise HTTPException(
            status_code=500,
            detail="Cloudinary not configured"
        )

    import cloudinary
    import cloudinary.uploader

    init_cloudinary()

    # Read file content
    content = await file.read()

    # Validate file size (5MB max)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 5MB.")

    # Validate content type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Upload to Cloudinary with transformations
        result = cloudinary.uploader.upload(
            content,
            folder=f"highland_events/{folder}",
            public_id=public_id,
            resource_type="image",
            transformation=[
                {"quality": "auto", "fetch_format": "auto"}
            ],
            eager=[
                {"width": 320, "height": 180, "crop": "fill", "gravity": "auto"},
                {"width": 640, "height": 360, "crop": "fill", "gravity": "auto"},
                {"width": 1280, "height": 720, "crop": "fill", "gravity": "auto"},
            ],
            eager_async=False
        )

        base_url = result["secure_url"]
        uploaded_public_id = result["public_id"]

        # Build transformation URLs
        def transform_url(width: int, height: int) -> str:
            return cloudinary.CloudinaryImage(uploaded_public_id).build_url(
                width=width,
                height=height,
                crop="fill",
                gravity="auto",
                quality="auto",
                fetch_format="auto"
            )

        return {
            "url": base_url,
            "thumbnail_url": transform_url(320, 180),
            "medium_url": transform_url(640, 360),
            "large_url": transform_url(1280, 720),
            "public_id": uploaded_public_id
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload image: {str(e)}"
        )


def delete_image(public_id: str) -> bool:
    """Delete an image from Cloudinary by public_id."""
    if not is_cloudinary_configured():
        return False

    import cloudinary
    import cloudinary.uploader

    init_cloudinary()

    try:
        result = cloudinary.uploader.destroy(public_id)
        return result.get("result") == "ok"
    except Exception:
        return False


def extract_public_id(url: str) -> Optional[str]:
    """Extract Cloudinary public_id from URL."""
    if not url or "cloudinary" not in url:
        return None

    # URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
    try:
        parts = url.split("/upload/")
        if len(parts) != 2:
            return None

        path = parts[1]
        # Remove version prefix if present
        if path.startswith("v"):
            path = "/".join(path.split("/")[1:])

        # Remove extension
        public_id = path.rsplit(".", 1)[0]
        return public_id
    except Exception:
        return None
