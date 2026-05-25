"""
icd_mapper.py
─────────────────────────────────────────────────────────────────────────────
Loads ICD-10 and CPT JSON data and maps entities/text to codes.
Called by coding_service.py.
"""

from __future__ import annotations

import json
import logging
import os

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# DATA LOADING
# ─────────────────────────────────────────────────────────────────────────────

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")


def _load_json(filename: str) -> list[dict]:
    path = os.path.join(_DATA_DIR, filename)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


_ICD10_DATA: list[dict] = _load_json("icd_codes.json")
_CPT_DATA:   list[dict] = _load_json("cpt_codes.json")


# ─────────────────────────────────────────────────────────────────────────────
# MATCHING LOGIC
# ─────────────────────────────────────────────────────────────────────────────

def _match_entity(entity_text: str, dataset: list[dict]) -> dict | None:
    """
    Try to match entity_text against a dataset entry.

    Match priority:
      1. Exact match on name
      2. Exact match on any synonym
      3. Substring match (entity inside synonym or synonym inside entity)
    """
    text = entity_text.lower().strip()

    exact_name:    dict | None = None
    exact_synonym: dict | None = None
    substring:     dict | None = None

    for entry in dataset:
        name     = entry["name"].lower()
        synonyms = [s.lower() for s in entry.get("synonyms", [])]

        # 1. Exact name match
        if text == name:
            exact_name = entry
            break

        # 2. Exact synonym match
        if text in synonyms:
            exact_synonym = exact_synonym or entry

        # 3. Substring match
        elif any(text in s or s in text for s in synonyms) or text in name or name in text:
            substring = substring or entry

    return exact_name or exact_synonym or substring


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def assign_codes(entities: list[dict], full_text: str = "") -> dict:
    """
    Map NLP entities to ICD-10 and CPT codes.

    Args:
        entities:  Output of extract_entities()
                   e.g. [{"text": "Diabetes Mellitus", "label": "DISEASE"}, ...]
        full_text: Cleaned text — used for CPT keyword matching.

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

        match = _match_entity(text, _ICD10_DATA)
        if match:
            code = match["icd10"]
            if code not in seen_icd10:
                seen_icd10.add(code)
                icd10_codes.append(code)
                diagnoses.append(match["name"])
        else:
            logger.debug("No ICD-10 match for entity: '%s'", text)

    # ── CPT: scan full text for procedure keywords ────────────────────────────
    text_lower = full_text.lower()

    for entry in _CPT_DATA:
        code     = entry["cpt"]
        synonyms = [s.lower() for s in entry.get("synonyms", [])]
        name     = entry["name"].lower()

        if code in seen_cpt:
            continue

        if name in text_lower or any(syn in text_lower for syn in synonyms):
            seen_cpt.add(code)
            cpt_codes.append(code)
            procedures.append(entry["name"])

    # ── Fallbacks ─────────────────────────────────────────────────────────────
    if not icd10_codes:
        logger.warning("No ICD-10 codes matched — using fallback Z00.00")
        icd10_codes = ["Z00.00"]
        diagnoses   = ["General Examination"]

    if not cpt_codes:
        logger.warning("No CPT codes matched — using fallback 99213")
        cpt_codes  = ["99213"]
        procedures = ["Established Patient Office Visit"]

    return {
        "icd10":     icd10_codes,
        "cpt":       cpt_codes,
        "diagnosis": diagnoses,
        "procedure": procedures,
    }