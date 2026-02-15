"""
Media upload API routes.
Uses Cloudinary in production when configured, local storage in development.
"""
from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from sqlmodel import Session
from typing import Optional
from app.core.database import get_session
from app.core.security import get_current_user
from app.models.user import User
from app.services.media import upload_image as local_upload, delete_image as local_delete
from app.services.cloudinary_service import (
    is_cloudinary_configured,
    upload_image as cloudinary_upload,
    delete_image as cloudinary_delete
)
from app.services.cloudflare_service import (
    is_cloudflare_configured,
    upload_to_cloudflare,
    get_cloudflare_url
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

    Uses Cloudflare when configured, then Cloudinary, then local storage.
    """
    if is_cloudflare_configured():
        image_id = await upload_to_cloudflare(file)
        return {
            "url": image_id,  # Storing ID as URL for Cloudflare images
            "id": image_id,
            "provider": "cloudflare",
            "thumbnail_url": get_cloudflare_url(image_id, "thumbnail"),
            "medium_url": get_cloudflare_url(image_id, "card"),
            "large_url": get_cloudflare_url(image_id, "hero")
        }
    
    if is_cloudinary_configured():
        return await cloudinary_upload(file, folder)
    else:
        # Fallback to local storage in development
        return await local_upload(file, folder)


@router.delete("/{folder}/{filename}")
async def delete_media(
    folder: str,
    filename: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    owner_type: Optional[str] = Query(None, description="'event' or 'venue'"),
    owner_id: Optional[str] = Query(None, description="ID of the owning entity"),
):
    """
    Delete an uploaded image and its variants.
    Only the owner of the associated entity (or an admin) may delete.
    """
    # --- Ownership check ---
    if not current_user.is_admin:
        if not owner_type or not owner_id:
            raise HTTPException(
                status_code=403,
                detail="owner_type and owner_id are required for non-admin users",
            )

        owner_id_normalized = owner_id.replace("-", "")

        if owner_type == "event":
            from app.models.event import Event
            entity = session.get(Event, owner_id_normalized)
            if not entity or str(entity.organizer_id) != str(current_user.id):
                raise HTTPException(status_code=403, detail="Not authorized to delete this image")
        elif owner_type == "venue":
            from app.models.venue import Venue
            entity = session.get(Venue, owner_id_normalized)
            if not entity or str(entity.owner_id) != str(current_user.id):
                raise HTTPException(status_code=403, detail="Not authorized to delete this image")
        else:
            raise HTTPException(status_code=400, detail="owner_type must be 'event' or 'venue'")

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

