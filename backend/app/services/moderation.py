"""
Content Moderation Service
Provides profanity detection for event submissions.
"""

from better_profanity import profanity
import logging

logger = logging.getLogger(__name__)

# Initialize the profanity filter with default word list
profanity.load_censor_words()


def check_is_offensive(text: str) -> bool:
    """
    Check if the given text contains offensive/profane language.
    
    Args:
        text: The text string to check (can be title, description, tags combined)
        
    Returns:
        True if profanity is detected, False otherwise
    """
    if not text or not text.strip():
        return False
    
    try:
        is_offensive = profanity.contains_profanity(text)
        if is_offensive:
            logger.warning(f"Offensive content detected in submission")
        return is_offensive
    except Exception as e:
        logger.error(f"Error checking for profanity: {e}")
        # On error, fail safe by not flagging as offensive
        return False


def censor_text(text: str) -> str:
    """
    Censor profane words in the given text.
    
    Args:
        text: The text to censor
        
    Returns:
        Text with profane words replaced with asterisks
    """
    if not text:
        return text
    
    try:
        return profanity.censor(text)
    except Exception as e:
        logger.error(f"Error censoring text: {e}")
        return text
