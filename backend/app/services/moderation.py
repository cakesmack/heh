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


def check_content_with_reason(text: str) -> dict:
    """
    Check if text contains offensive language and return the specific trigger.
    
    Args:
        text: The text to check (title, description, tags combined)
        
    Returns:
        dict with 'flagged' (bool) and 'reason' (str or None)
    """
    if not text or not text.strip():
        return {"flagged": False, "reason": None}
    
    try:
        # Check if profanity exists
        if not profanity.contains_profanity(text):
            return {"flagged": False, "reason": None}
        
        # Find the specific word(s) that triggered
        # better-profanity censors words with *, so we compare to find them
        censored = profanity.censor(text)
        words = text.split()
        censored_words = censored.split()
        
        triggers = []
        for i, (orig, cens) in enumerate(zip(words, censored_words)):
            # If the word was censored (contains *), it's a trigger
            if '*' in cens and orig != cens:
                triggers.append(orig.lower())
        
        if triggers:
            # Remove duplicates and limit to first 3
            unique_triggers = list(dict.fromkeys(triggers))[:3]
            reason = f"Contains: {', '.join(unique_triggers)}"
        else:
            reason = "Flagged by content filter"
        
        logger.warning(f"Offensive content detected: {reason}")
        return {"flagged": True, "reason": reason}
        
    except Exception as e:
        logger.error(f"Error checking content: {e}")
        return {"flagged": False, "reason": None}
