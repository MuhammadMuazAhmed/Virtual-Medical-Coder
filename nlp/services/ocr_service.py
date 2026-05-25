# pyrefly: ignore [missing-import]
import fitz  # PyMuPDF
import io
# pyrefly: ignore [missing-import]
from PIL import Image, ImageFilter, ImageEnhance
# pyrefly: ignore [missing-import]
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


def _ocr_image(image: Image.Image) -> str:
    """
    Preprocess image and run Tesseract OCR.
    Grayscale + contrast boost improves accuracy on medical scans.
    """
    image = image.convert("L")                          # grayscale
    image = ImageEnhance.Contrast(image).enhance(2.0)   # boost contrast
    return pytesseract.image_to_string(image)


def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """
    Extracts text from PDF, image, or plain text files.
    For PDFs: uses embedded text first, falls back to OCR per page if needed.
    """
    if not filename:
        return ""

    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext == "pdf":
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            pages_text = []

            for page in doc:
                page_text = page.get_text().strip()

                # If page has no selectable text, OCR it (scanned PDF)
                if not page_text:
                    pix = page.get_pixmap(dpi=200)
                    image = Image.open(io.BytesIO(pix.tobytes("png")))
                    try:
                        page_text = _ocr_image(image)
                    except pytesseract.TesseractNotFoundError:
                        page_text = "[OCR Warning: Tesseract not found — scanned page skipped]"

                pages_text.append(page_text)

            return "\n".join(pages_text)

        except Exception as e:
            return f"Error extracting from PDF: {str(e)}"

    elif ext in ["png", "jpg", "jpeg", "tiff", "bmp", "webp"]:
        try:
            image = Image.open(io.BytesIO(file_bytes))
            return _ocr_image(image)
        except pytesseract.TesseractNotFoundError:
            return "[OCR Warning: Tesseract OCR binary not found. Please install Tesseract-OCR.]"
        except Exception as e:
            return f"Error performing OCR: {str(e)}"

    else:
        try:
            return file_bytes.decode("utf-8")
        except Exception:
            return "[Error: Unsupported file format or binary data could not be parsed as text.]"