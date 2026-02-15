import httpx
import logging
from typing import Optional, Dict
from fastapi import UploadFile, HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

async def upload_to_cloudflare(file: UploadFile) -> str:
    """
    Upload an image to Cloudflare Images.
    Returns the image ID.
    """
    if not all([settings.CLOUDFLARE_ACCOUNT_ID, settings.CLOUDFLARE_API_TOKEN]):
        raise HTTPException(
            status_code=500,
            detail="Cloudflare Images not configured"
        )

    url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/images/v1"
    headers = {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}"
    }

    # Read file content
    content = await file.read()
    
    # Reset file pointer for potential future reads (important for multifiles)
    await file.seek(0)

    files = {
        "file": (file.filename, content, file.content_type)
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, files=files)
            response.raise_for_status()
            result = response.json()
            
            if not result.get("success"):
                logger.error(f"Cloudflare upload failed: {result.get('errors')}")
                raise HTTPException(status_code=500, detail="Cloudflare upload failed")
                
            return result["result"]["id"]
        except httpx.HTTPStatusError as e:
            logger.error(f"Cloudflare API error: {e.response.text}")
            raise HTTPException(
                status_code=e.response.status_code,
                detail=f"Cloudflare upload failed: {e.response.text}"
            )
        except Exception as e:
            logger.error(f"Cloudflare upload exception: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"An error occurred during Cloudflare upload: {str(e)}"
            )

def get_cloudflare_url(image_id: str, variant: str = "public") -> str:
    """Get the delivery URL for a Cloudflare image."""
    return f"https://imagedelivery.net/{settings.CLOUDFLARE_ACCOUNT_HASH}/{image_id}/{variant}"

def is_cloudflare_configured() -> bool:
    """Check if Cloudflare Images is configured."""
    return all([
        settings.CLOUDFLARE_ACCOUNT_ID,
        settings.CLOUDFLARE_API_TOKEN,
        settings.CLOUDFLARE_ACCOUNT_HASH
    ])
