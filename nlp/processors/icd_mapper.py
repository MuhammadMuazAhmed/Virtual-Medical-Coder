"""
icd_mapper.py
─────────────────────────────────────────────────────────────────────────────
Maps NLP entities to ICD-10 and CPT codes by querying MongoDB Atlas.
Called by coding_service.py.

Collections used:
    test.icd10_codes  — imported via import_icd10.py
    test.cpt_codes    — imported via import_cpt.py

Each document structure:
    { code, description, synonyms: [] }
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DB CONNECTION  (one client, cached for process lifetime)
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_db():
    uri    = os.getenv("MONGODB_URI")
    client = MongoClient(uri)
    return client["test"]


def _icd10_col():
    return _get_db()["icd10_codes"]


def _cpt_col():
    return _get_db()["cpt_codes"]


# ─────────────────────────────────────────────────────────────────────────────
# MATCHING LOGIC
# ─────────────────────────────────────────────────────────────────────────────

def _match_icd10(entity_text: str) -> dict | None:
    """
    Match entity text to an ICD-10 code using 3-step lookup:
      1. Exact code match       (e.g. entity is already "E11.9")
      2. Exact synonym match    (entity in synonyms array)
      3. Full-text search       (MongoDB text index on description + synonyms)
    """
    col  = _icd10_col()
    text = entity_text.strip()

    # 1. Exact code match
    result = col.find_one({"code": text.upper()})
    if result:
        return result

    # 2. Synonym match (case-insensitive)
    result = col.find_one({"synonyms": {"$regex": f"^{text}$", "$options": "i"}})
    if result:
        return result

    # 3. Full-text search on description
    results = list(
        col.find(
            {"$text": {"$search": text}},
            {"score": {"$meta": "textScore"}, "code": 1, "description": 1, "synonyms": 1}
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(1)
    )
    if results:
        return results[0]

    return None


def _match_cpt(keyword: str) -> dict | None:
    """
    Match a keyword to a CPT/HCPCS code using 3-step lookup:
      1. Exact code match
      2. Exact synonym match
      3. Full-text search on description
    """
    col  = _cpt_col()
    text = keyword.strip()

    # 1. Exact code match
    result = col.find_one({"code": text.upper()})
    if result:
        return result

    # 2. Synonym match
    result = col.find_one({"synonyms": {"$regex": f"^{text}$", "$options": "i"}})
    if result:
        return result

    # 3. Full-text search
    results = list(
        col.find(
            {"$text": {"$search": text}},
            {"score": {"$meta": "textScore"}, "code": 1, "description": 1, "synonyms": 1}
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(1)
    )
    if results:
        return results[0]

    return None


# ─────────────────────────────────────────────────────────────────────────────
# CPT KEYWORD EXTRACTION FROM TEXT
# ─────────────────────────────────────────────────────────────────────────────

# Procedure-related keywords to scan for in the full clinical text.
# These are terms that rarely appear as NER entities but indicate procedures.
CPT_SCAN_KEYWORDS = [
    "ecg", "ekg", "electrocardiogram",
    "chest x-ray", "chest xray", "cxr",
    "mri", "ct scan", "ultrasound", "sonography",
    "spirometry", "pulmonary function test", "pft",
    "colonoscopy", "endoscopy", "bronchoscopy",
    "complete blood count", "cbc", "fbc",
    "comprehensive metabolic panel", "cmp",
    "basic metabolic panel", "bmp",
    "hba1c", "hemoglobin a1c",
    "fasting blood sugar", "fbs", "blood glucose",
    "tsh", "thyroid function",
    "lipid profile", "cholesterol panel",
    "liver function test", "lft",
    "kidney function test", "kft",
    "urinalysis", "urine culture",
    "blood culture",
    "inr", "prothrombin time",
    "crp", "c-reactive protein",
    "follow up", "follow-up", "office visit",
    "hospital admission", "admitted",
    "physical therapy", "physiotherapy",
    "psychotherapy", "counselling",
    "nebulizer", "inhaler",
    "vaccination", "immunization",
    "biopsy", "wound repair", "suture",
    "joint injection", "steroid injection",
    "chemotherapy", "dialysis",
]


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def assign_codes(entities: list[dict], full_text: str = "") -> dict:
    """
    Map NLP entities to ICD-10 and CPT codes using MongoDB lookup.

    Args:
        entities:  Output of extract_entities()
                   e.g. [{"text": "Diabetes Mellitus", "label": "DISEASE"}, ...]
        full_text: Cleaned clinical text — scanned for CPT procedure keywords.

    Returns:
        {
            "icd10":     list[str],
            "cpt":       list[str],
            "diagnosis": list[str],
            "procedure": list[str],
        }
    """

    icd10_codes: list[str] = []
    diagnoses:   list[str] = []
    cpt_codes:   list[str] = []
    procedures:  list[str] = []

    seen_icd10: set[str] = set()
    seen_cpt:   set[str] = set()

    # ── ICD-10: match each NLP entity ────────────────────────────────────────
    for entity in entities:
        text  = entity.get("text", "")
        label = entity.get("label", "")

        if label not in ("DISEASE", "CHEMICAL", ""):
            continue

        match = _match_icd10(text)
        if match:
            code = match["code"]
            if code not in seen_icd10:
                seen_icd10.add(code)
                icd10_codes.append(code)
                diagnoses.append(match["description"])
        else:
            logger.debug("No ICD-10 match for entity: '%s'", text)

    # ── CPT: scan full text for procedure keywords ────────────────────────────
    text_lower = full_text.lower()

    for keyword in CPT_SCAN_KEYWORDS:
        if keyword not in text_lower:
            continue

        match = _match_cpt(keyword)
        if match:
            code = match["code"]
            if code not in seen_cpt:
                seen_cpt.add(code)
                cpt_codes.append(code)
                procedures.append(match["description"])

    # ── Fallbacks ─────────────────────────────────────────────────────────────
    if not icd10_codes:
        logger.warning("No ICD-10 codes matched — using fallback Z00.00")
        icd10_codes = ["Z00.00"]
        diagnoses   = ["Encounter for general examination without abnormal findings"]

    if not cpt_codes:
        logger.warning("No CPT codes matched — using fallback 99213")
        cpt_codes  = ["99213"]
        procedures = ["Office or other outpatient visit, established patient"]

    return {
        "icd10":     icd10_codes,
        "cpt":       cpt_codes,
        "diagnosis": diagnoses,
        "procedure": procedures,
    }