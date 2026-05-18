from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

from services.ocr_service import extract_text_from_file
from utils.text_cleaner import clean_text

router = APIRouter()


@router.post("/process-file")
async def process_file(file: UploadFile = File(...)):

    try:

        # ─────────────────────────────────────────────
        # READ FILE
        # ─────────────────────────────────────────────

        contents = await file.read()

        # ─────────────────────────────────────────────
        # OCR / TEXT EXTRACTION
        # ─────────────────────────────────────────────

        extracted_text = extract_text_from_file(
            file_bytes=contents,
            filename=file.filename
        )

        # ─────────────────────────────────────────────
        # CLEAN TEXT
        # ─────────────────────────────────────────────

        cleaned_text = clean_text(extracted_text)

        # ─────────────────────────────────────────────
        # TEMP MOCK NLP RESPONSE
        # (REAL NLP COMES NEXT)
        # ─────────────────────────────────────────────

        result = {
            "text": cleaned_text,

            # Temporary mock values
            "icd10": [
                "E11",   # Diabetes
            ],

            "cpt": [
                "99213"
            ],

            "diagnosis": [
                "Diabetes Mellitus"
            ],

            "procedure": [
                "General Consultation"
            ]
        }

        return JSONResponse(
            status_code=200,
            content=result
        )

    except Exception as e:

        print("PROCESS FILE ERROR:", str(e))

        return JSONResponse(
            status_code=500,
            content={
                "error": str(e)
            }
        )