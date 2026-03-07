import httpx
import logging
from typing import Optional, Dict
from fastapi import UploadFile, HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)

async def upload_to_cloudflare(file: UploadFile, client: Optional[httpx.AsyncClient] = None) -> str:
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

    # Use provided client or create one
    manage_client = client is None
    if manage_client:
        client = httpx.AsyncClient()

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
    finally:
        if manage_client:
            await client.aclose()

async def upload_url_to_cloudflare(image_url: str, client: Optional[httpx.AsyncClient] = None) -> str:
    """
    Upload an image to Cloudflare Images via a URL.
    Returns the image ID.
    Cloudflare will fetch the image directly from the provided URL.
    """
    if not is_cloudflare_configured():
        raise HTTPException(
            status_code=500,
            detail="Cloudflare Images not configured"
        )

    url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/images/v1"
    headers = {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}"
    }

    # Cloudflare expects multipart/form-data for the 'url' parameter
    # CRITICAL: It requires a filename index in the tuple, otherwise it fails with 415
    files = {
        "url": ("url.txt", image_url)
    }

    logger.info(f"Uploading URL to Cloudflare: {image_url}")

    # Use provided client or create one
    manage_client = client is None
    if manage_client:
        client = httpx.AsyncClient()

    try:
        response = await client.post(url, headers=headers, files=files)
        logger.info(f"Cloudflare response status: {response.status_code}")
        response.raise_for_status()
        result = response.json()
        
        if not result.get("success"):
            logger.error(f"Cloudflare URL upload failed: {result.get('errors')}")
            raise HTTPException(status_code=500, detail="Cloudflare URL upload failed")
            
        return result["result"]["id"]
    except httpx.HTTPStatusError as e:
        logger.error(f"Cloudflare API error (URL upload): {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cloudflare URL upload failed: {e.response.text}"
        )
    except Exception as e:
        logger.error(f"Cloudflare URL upload exception: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during Cloudflare URL upload: {str(e)}"
        )
    finally:
        if manage_client:
            await client.aclose()


async def sideload_url_to_cloudflare(image_url: str, client: Optional[httpx.AsyncClient] = None) -> str:
    """
    Download an image from an external URL using browser-like headers
    (to bypass hotlink protection), then upload the bytes to Cloudflare Images.
    Returns the Cloudflare image ID.
    """
    if not is_cloudflare_configured():
        raise HTTPException(
            status_code=500,
            detail="Cloudflare Images not configured"
        )

    # Browser-like headers to bypass hotlink / UA blocking
    download_headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.hiclimatefest.co.uk/",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    }

    manage_client = client is None
    if manage_client:
        client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)

    try:
        # Step 1: Download the image with browser headers
        logger.info(f"Sideloading image from: {image_url}")
        dl_response = await client.get(image_url, headers=download_headers)
        dl_response.raise_for_status()

        content = dl_response.content
        content_type = dl_response.headers.get("content-type", "image/jpeg")

        # Guess a filename from the URL
        from urllib.parse import urlparse
        path = urlparse(image_url).path
        filename = path.split("/")[-1] if "/" in path else "image.jpg"
        if "." not in filename:
            filename = "image.jpg"

        # Step 2: Upload the bytes to Cloudflare
        cf_url = f"https://api.cloudflare.com/client/v4/accounts/{settings.CLOUDFLARE_ACCOUNT_ID}/images/v1"
        cf_headers = {
            "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}"
        }
        files = {
            "file": (filename, content, content_type)
        }

        cf_response = await client.post(cf_url, headers=cf_headers, files=files)
        cf_response.raise_for_status()
        result = cf_response.json()

        if not result.get("success"):
            logger.error(f"Cloudflare upload failed: {result.get('errors')}")
            raise HTTPException(status_code=500, detail="Cloudflare upload failed")

        image_id = result["result"]["id"]
        logger.info(f"Sideloaded to Cloudflare: {image_id}")
        return image_id

    except httpx.HTTPStatusError as e:
        logger.error(f"Sideload HTTP error: {e.response.status_code} for {image_url}")
        raise HTTPException(
            status_code=400,
            detail=f"Image sideload failed ({e.response.status_code}): {image_url}"
        )
    except Exception as e:
        logger.error(f"Sideload exception for {image_url}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image sideload failed: {str(e)}"
        )
    finally:
        if manage_client:
            await client.aclose()


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
