"""
Media upload API routes.
Uses Cloudinary in production when configured, local storage in development.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from app.core.security import get_current_user
from app.models.user import User
from app.services.media import upload_image as local_upload, delete_image as local_delete
from app.services.cloudinary_service import (
    is_cloudinary_configured,
    upload_image as cloudinary_upload,
    delete_image as cloudinary_delete
)

router = APIRouter(tags=["Media"])


@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = Query(..., pattern="^(events|venues|categories|organizers|hero)$"),
    current_user: User = Depends(get_current_user)
):
    """
    Upload an image file.

    Folder must be one of: events, venues, categories
    Returns URLs for original and size variants.

    Uses Cloudinary when configured, falls back to local storage.
    """
    if is_cloudinary_configured():
        return await cloudinary_upload(file, folder)
    else:
        # Fallback to local storage in development
        return await local_upload(file, folder)


@router.delete("/{folder}/{filename}")
async def delete_media(
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete an uploaded image and its variants.
    """
    # Try Cloudinary first
    if is_cloudinary_configured():
        public_id = f"highland_events/{folder}/{filename.rsplit('.', 1)[0]}"
        if cloudinary_delete(public_id):
            return {"deleted": True}

    # Fallback to local deletion
    url = f"/static/uploads/{folder}/{filename}"
    success = local_delete(url)

    if not success:
        raise HTTPException(status_code=404, detail="Image not found")

    return {"deleted": True}
