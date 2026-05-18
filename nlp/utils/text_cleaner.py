import re

def clean_text(text: str) -> str:
    """
    Cleans clinical text by removing excessive newlines and whitespace.
    """
    if not text:
        return ""
        
    # Replace multiple whitespaces and newlines with a single space
    cleaned = re.sub(r"\s+", " ", text)
    
    return cleaned.strip()
