import fitz  # PyMuPDF
import io
from PIL import Image
import pytesseract
import os

# Set common Windows Tesseract paths if available
tesseract_paths = [
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
]
for path in tesseract_paths:
    if os.path.exists(path):
        pytesseract.pytesseract.tesseract_cmd = path
        break

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Extracts text from various file formats (PDF, Image, or plain text).
    """
    if not filename:
        return ""
        
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext == "pdf":
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text()
            return text
        except Exception as e:
            return f"Error extracting from PDF: {str(e)}"
            
    elif ext in ["png", "jpg", "jpeg", "tiff", "bmp", "webp"]:
        try:
            image = Image.open(io.BytesIO(file_bytes))
            text = pytesseract.image_to_string(image)
            return text
        except pytesseract.TesseractNotFoundError:
            return "[OCR Warning: Tesseract OCR binary not found on Windows. Please install Tesseract-OCR to enable image text extraction.]"
        except Exception as e:
            return f"Error performing OCR: {str(e)}"
            
    else:
        # Fallback to plain text decoding
        try:
            return file_bytes.decode("utf-8")
        except Exception:
            return "[Error: Unsupported file format or binary data could not be parsed as text.]"
