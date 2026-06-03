# pyrefly: ignore [missing-import]
from fastapi import APIRouter, UploadFile, File
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

from services.ocr_service import extract_text_from_file
from services.nlp_service import run_nlp
from utils.text_cleaner import clean_text

router = APIRouter()


class ProcessNoteRequest(BaseModel):
    """Request body for /process-note endpoint."""
    text: str
    explain: bool = True  # Return explainable results (code + evidence + matchType)


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

        nlp_result = run_nlp(cleaned_text, explain=True)

        # ✅ Ensure proper serialization of dataclass objects
        icd10_data = nlp_result["icd10"]
        if icd10_data and isinstance(icd10_data[0], dict):
            icd10_list = icd10_data  # Already dict format
        else:
            icd10_list = [item.to_dict() if hasattr(item, 'to_dict') else item for item in icd10_data]

        cpt_data = nlp_result["cpt"]
        if cpt_data and isinstance(cpt_data[0], dict):
            cpt_list = cpt_data  # Already dict format
        else:
            cpt_list = [item.to_dict() if hasattr(item, 'to_dict') else item for item in cpt_data]

        result = {
            "text":      cleaned_text,
            "icd10":     icd10_list,
            "cpt":       cpt_list,
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


@router.post("/process-note")
async def process_note(request: ProcessNoteRequest):
    """
    Process plain text clinical note and return ICD-10/CPT codes with evidence.

    Args:
        text: Plain text clinical note
        explain: If True, return explainable results (code/evidence/matchType);
                 if False, return legacy format

    Returns:
        {
            "text": "...",
            "icd10": [
                {"code": "E11.9", "evidence": "Type 2 Diabetes", "matchType": "entity_match", "confidence": 0.95},
                ...
            ],
            "cpt": [
                {"code": "99213", "evidence": "office visit", "matchType": "keyword_scan", "confidence": 1.0},
                ...
            ]
        }
    """
    try:

        if not request.text or not request.text.strip():
            return JSONResponse(
                status_code=400,
                content={"error": "Text is required"}
            )

        # ─────────────────────────────────────────────
        # CLEAN TEXT
        # ─────────────────────────────────────────────

        cleaned_text = clean_text(request.text)

        # ─────────────────────────────────────────────
        # NLP — entity extraction + ICD-10 + CPT
        # ─────────────────────────────────────────────

        nlp_result = run_nlp(cleaned_text, explain=request.explain)

        # ✅ Ensure proper serialization of dataclass objects
        icd10_data = nlp_result["icd10"]
        if icd10_data and isinstance(icd10_data[0], dict):
            icd10_list = icd10_data  # Already dict format
        else:
            icd10_list = [item.to_dict() if hasattr(item, 'to_dict') else item for item in icd10_data]

        cpt_data = nlp_result["cpt"]
        if cpt_data and isinstance(cpt_data[0], dict):
            cpt_list = cpt_data  # Already dict format
        else:
            cpt_list = [item.to_dict() if hasattr(item, 'to_dict') else item for item in cpt_data]

        result = {
            "text": cleaned_text,
            "icd10": icd10_list,
            "cpt": cpt_list,
        }

        # Include legacy fields if not explaining (backward compatibility)
        if not request.explain:
            result["diagnosis"] = nlp_result.get("diagnosis", [])
            result["procedure"] = nlp_result.get("procedure", [])

        return JSONResponse(
            status_code=200,
            content=result
        )

    except Exception as e:

        print("PROCESS NOTE ERROR:", str(e))

        return JSONResponse(
            status_code=500,
            content={
                "error": str(e)
            }
        )