"""
icd_mapper.py
─────────────────────────────────────────────────────────────────────────────
Maps NLP entities to ICD-10 and CPT codes using a 3-tier lookup:

  Tier 1 — Exact code or synonym match    (MongoDB query)
  Tier 2 — Full-text search               (MongoDB text index)
  Tier 3 — Semantic similarity            (sentence-transformers)

Also includes a rule-based fallback for conditions scispaCy consistently misses.
"""

from __future__ import annotations

import logging
import os
import re
from functools import lru_cache

from dotenv import load_dotenv
from pymongo import MongoClient

from processors.semantic_matcher import find_best_icd10, find_best_cpt

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DB CONNECTION
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
# RULE-BASED FALLBACK
# Conditions scispaCy consistently misses — scan full text directly
# Format: { "keyword": "ICD-10 code" }
# ─────────────────────────────────────────────────────────────────────────────

NER_FALLBACK_RULES: dict[str, str] = {
    # Hypertension
    "hypertension":              "I10",
    "essential hypertension":    "I10",
    "high blood pressure":       "I10",

    # Diabetes
    "type 2 diabetes":           "E119",
    "type 2 diabetes mellitus":  "E119",
    "t2dm":                      "E119",
    "poorly controlled diabetes":"E119",
    "uncontrolled diabetes":     "E119",
    "type 1 diabetes":           "E109",
    "t1dm":                      "E109",

    # Lipids
    "hyperlipidemia":            "E785",
    "hyperlipidaemia":           "E785",
    "dyslipidemia":              "E785",
    "high cholesterol":          "E785",

    # Obesity
    "obesity":                   "E669",
    "obese":                     "E669",
    "morbid obesity":            "E669",

    # Cardiac
    "atrial fibrillation":       "I4891",
    "afib":                      "I4891",
    "heart failure":             "I509",
    "congestive heart failure":  "I509",
    "coronary artery disease":   "I2510",

    # Respiratory
    "copd":                      "J449",
    "chronic obstructive pulmonary disease": "J449",
    "asthma":                    "J45909",

    # Kidney
    "chronic kidney disease":    "N189",
    "ckd":                       "N189",

    # Thyroid
    "hypothyroidism":            "E039",
    "hyperthyroidism":           "E0590",

    # Mental health
    "depression":                "F329",
    "anxiety":                   "F411",

    # GI
    "gerd":                      "K219",
    "acid reflux":               "K219",

    # Infectious
    "tuberculosis":              "A159",
    "hiv":                       "B20",
}

# Negation words — if any of these appear before a keyword in the same
# sentence, skip that keyword
NEGATION_WORDS = [
    "no ", "not ", "denies ", "deny ", "denied ", "without ",
    "absence of ", "absent ", "negative for ", "no history of ",
    "no known ", "ruled out ", "rule out "
]


def _apply_fallback_rules(text: str, seen_codes: set) -> tuple[list, list]:
    """
    Scan full text for conditions scispaCy misses.
    Respects simple negation — skips keyword if preceded by negation word
    in the same sentence.
    """
    text_lower  = text.lower()
    sentences   = re.split(r'[.\n]', text_lower)

    icd10_codes: list[str] = []
    diagnoses:   list[str] = []

    for keyword, code in NER_FALLBACK_RULES.items():
        if code in seen_codes:
            continue

        for sentence in sentences:
            if keyword not in sentence:
                continue

            # Check negation in this sentence
            negated = any(
                neg in sentence and sentence.index(neg) < sentence.index(keyword)
                for neg in NEGATION_WORDS
                if neg in sentence and keyword in sentence
            )

            if not negated:
                seen_codes.add(code)
                icd10_codes.append(code)
                # Get description from MongoDB
                doc = _icd10_col().find_one({"code": code}, {"description": 1})
                diagnoses.append(doc["description"] if doc else keyword.title())
                break

    return icd10_codes, diagnoses


# ─────────────────────────────────────────────────────────────────────────────
# ICD-10 MATCHING  (3-tier)
# ─────────────────────────────────────────────────────────────────────────────

def _match_icd10(entity_text: str) -> dict | None:
    col  = _icd10_col()
    text = entity_text.strip()

    # Tier 1a — Exact code match (try with and without dots)
    result = col.find_one({"code": text.upper()})
    if not result:
        result = col.find_one({"code": text.upper().replace(".", "")})
    if result:
        return result

    # Tier 1b — Exact synonym match (case-insensitive)
    result = col.find_one({"synonyms": {"$regex": f"^{re.escape(text)}$", "$options": "i"}})
    if result:
        return result

    # Tier 2 — Full-text search
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

    # Tier 3 — Semantic similarity fallback
    return find_best_icd10(text, _get_db())


# ─────────────────────────────────────────────────────────────────────────────
# CPT MATCHING  (3-tier)
# ─────────────────────────────────────────────────────────────────────────────

def _match_cpt(keyword: str) -> dict | None:
    col  = _cpt_col()
    text = keyword.strip()

    # Tier 1a — Exact code match
    result = col.find_one({"code": text.upper()})
    if result:
        return result

    # Tier 1b — Exact synonym match
    result = col.find_one({"synonyms": {"$regex": f"^{re.escape(text)}$", "$options": "i"}})
    if result:
        return result

    # Tier 2 — Full-text search
    results = list(
        col.find(
            {"$text": {"$search": text}},
            {"score": {"$meta": "textScore"}, "code": 1, "description": 1}
        )
        .sort([("score", {"$meta": "textScore"})])
        .limit(1)
    )
    if results:
        return results[0]

    # Tier 3 — Semantic similarity fallback
    return find_best_cpt(text, _get_db())


# ─────────────────────────────────────────────────────────────────────────────
# CPT KEYWORD SCAN LIST
# ─────────────────────────────────────────────────────────────────────────────

CPT_SCAN_KEYWORDS = [
    "electrocardiogram", "echocardiogram", "stress test",
    "chest x-ray", "chest xray",
    "mri", "ct scan", "ultrasound", "sonography",
    "spirometry", "pulmonary function test",
    "colonoscopy", "endoscopy", "bronchoscopy",
    "complete blood count", "comprehensive metabolic panel",
    "basic metabolic panel", "liver function test",
    "kidney function test", "thyroid function test",
    "thyroid stimulating hormone",
    "hemoglobin a1c", "fasting blood sugar", "blood glucose",
    "lipid profile", "cholesterol panel",
    "urinalysis", "urine culture", "blood culture",
    "international normalized ratio", "prothrombin time",
    "c-reactive protein", "erythrocyte sedimentation rate",
    "follow up", "office visit", "hospital admission",
    "physical therapy", "physiotherapy", "psychotherapy",
    "nebulizer", "vaccination", "immunization",
    "biopsy", "wound repair", "suture",
    "joint injection", "steroid injection",
    "chemotherapy", "dialysis", "infusion",
]


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def assign_codes(entities: list[dict], full_text: str = "") -> dict:
    """
    Map NLP entities to ICD-10 and CPT codes.

    Args:
        entities:  Output of extract_entities() — affirmed, current entities only
        full_text: Full cleaned text for fallback rules and CPT keyword scanning

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

    # ── ICD-10 from NER entities ──────────────────────────────────────────────
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
            logger.debug("No ICD-10 match for: '%s'", text)

    # ── ICD-10 fallback rules (for conditions scispaCy misses) ────────────────
    fallback_codes, fallback_diagnoses = _apply_fallback_rules(full_text, seen_icd10)
    icd10_codes.extend(fallback_codes)
    diagnoses.extend(fallback_diagnoses)

    # ── CPT from full text keyword scan ───────────────────────────────────────
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
        icd10_codes = ["Z00.00"]
        diagnoses   = ["Encounter for general examination without abnormal findings"]

    if not cpt_codes:
        cpt_codes  = ["99213"]
        procedures = ["Office or other outpatient visit, established patient"]

    return {
        "icd10":     icd10_codes,
        "cpt":       cpt_codes,
        "diagnosis": diagnoses,
        "procedure": procedures,
    }