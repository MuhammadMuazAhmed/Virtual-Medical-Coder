# pyrefly: ignore [missing-import]
from fastapi import APIRouter, UploadFile, File
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse

from services.ocr_service import extract_text_from_file
from services.nlp_service import run_nlp
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
        # NLP — entity extraction + ICD-10 + CPT
        # ─────────────────────────────────────────────

        nlp_result = run_nlp(cleaned_text)

        result = {
            "text":      cleaned_text,
            "icd10":     nlp_result["icd10"],
            "cpt":       nlp_result["cpt"],
            "diagnosis": nlp_result["diagnosis"],
            "procedure": nlp_result["procedure"],
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