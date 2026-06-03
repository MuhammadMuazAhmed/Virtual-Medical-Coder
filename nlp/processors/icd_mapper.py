"""
icd_mapper.py
─────────────────────────────────────────────────────────────────────────────
REFACTORED: Production-grade ICD-10/CPT code mapping with improved accuracy.

Maps NLP entities to ICD-10 and CPT codes using a 4-tier lookup:

  Tier 1 — Exact code or synonym match    (MongoDB query)
  Tier 2 — Full-text search               (MongoDB text index)
  Tier 3 — Semantic similarity            (sentence-transformers)
  Tier 4 — Concept-based matching         (trauma_extractor → semantic search)

KEY IMPROVEMENTS:
  • Trauma/injury keywords → medical concepts → ICD search (not hardcoded codes)
  • Context filtering: negation, historical, resolved markers
  • Confidence scoring for ranking candidates
  • Dedicated trauma extraction layer prevents medically incorrect codes
  • Body-part aware: only specific codes when location is explicit

BACKWARD COMPATIBILITY:
  • assign_codes() API unchanged
  • MongoDB collections unchanged
  • Existing entity extraction unchanged
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv
from pymongo import MongoClient

from processors.semantic_matcher import find_best_icd10, find_best_cpt
from processors.trauma_extractor import extract_trauma_entities, deduplicate_trauma_concepts

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# CANDIDATE RANKING DATACLASS
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ICDCandidate:
    """ICD code candidate with confidence metrics."""
    code: str
    description: str
    exact_match: float = 0.0        # 1.0 if exact code/synonym match, 0.0 otherwise
    fulltext_score: float = 0.0     # MongoDB fulltext score (normalized 0-1)
    semantic_score: float = 0.0     # Semantic similarity 0-1
    trauma_boost: float = 0.0       # Trauma-specific relevance +0.1 for injury codes
    final_confidence: float = 0.0   # Combined score

    def calculate_confidence(self) -> float:
        """Calculate final confidence score (weighted average)."""
        # Weights: exact match is strongest, semantic is backup
        weights = {
            "exact_match": 0.4,
            "fulltext_score": 0.25,
            "semantic_score": 0.25,
            "trauma_boost": 0.1,
        }

        self.final_confidence = (
            self.exact_match * weights["exact_match"]
            + self.fulltext_score * weights["fulltext_score"]
            + self.semantic_score * weights["semantic_score"]
            + self.trauma_boost * weights["trauma_boost"]
        )
        return self.final_confidence

    def to_dict(self) -> dict:
        """Return candidate as dict with confidence."""
        return {
            "code": self.code,
            "description": self.description,
            "confidence": round(self.final_confidence, 3),
        }


@dataclass
class ICD10Result:
    """Explainable ICD-10 result with evidence tracking."""
    code: str
    evidence: str                  # Original text that caused the match
    matchType: str                 # entity_match, fallback_rule, trauma_match, semantic_match
    confidence: float = 1.0        # Confidence score 0-1

    def to_dict(self) -> dict:
        """Return as dict for JSON serialization."""
        return {
            "code": self.code,
            "evidence": self.evidence,
            "matchType": self.matchType,
            "confidence": round(self.confidence, 3),
        }


@dataclass
class CPTResult:
    """Explainable CPT result with evidence tracking."""
    code: str
    evidence: str                  # Procedure keyword or entity text
    matchType: str                 # keyword_scan, semantic_match
    confidence: float = 1.0

    def to_dict(self) -> dict:
        """Return as dict for JSON serialization."""
        return {
            "code": self.code,
            "evidence": self.evidence,
            "matchType": self.matchType,
            "confidence": round(self.confidence, 3),
        }


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
# RULE-BASED FALLBACK: CHRONIC CONDITIONS & NON-TRAUMA ENTITIES
# Format: { "keyword": "ICD-10 code" }
# NOTE: Trauma keywords are handled by trauma_extractor.py → _match_icd10()
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

# Negation and context markers
NEGATION_WORDS = [
    "no ", "not ", "denies ", "deny ", "denied ", "without ",
    "absence of ", "absent ", "negative for ", "no history of ",
    "no known ", "ruled out ", "rule out "
]

RESOLVED_MARKERS = [
    "resolved", "recovered from", "recovered", "healed",
    "history of", "past", "previous", "prior", "old",
]

UNCERTAIN_MARKERS = [
    "possible", "possibly", "may have", "might have", "suspected",
    "concern for", "rule out", "r/o",
]


def _is_negated(text: str, keyword_pos: int) -> bool:
    """Check if keyword is negated within the same sentence."""
    # Find sentence boundaries
    sent_start = max(0, text.rfind(".", 0, keyword_pos), text.rfind("\n", 0, keyword_pos))
    sent_text = text[sent_start:keyword_pos].lower()

    return any(neg in sent_text for neg in NEGATION_WORDS)


def _is_resolved_context(text: str, keyword_pos: int) -> bool:
    """Check if keyword is in a resolved/historical context."""
    sent_start = max(0, text.rfind(".", 0, keyword_pos), text.rfind("\n", 0, keyword_pos))
    sent_text = text[sent_start:keyword_pos].lower()

    return any(marker in sent_text for marker in RESOLVED_MARKERS)


def _is_uncertain_context(text: str, keyword_pos: int) -> bool:
    """Check if keyword is in an uncertain/suspected context."""
    sent_start = max(0, text.rfind(".", 0, keyword_pos), text.rfind("\n", 0, keyword_pos))
    sent_text = text[sent_start:keyword_pos].lower()

    return any(marker in sent_text for marker in UNCERTAIN_MARKERS)


def _apply_fallback_rules(text: str, seen_codes: set) -> tuple[list, list]:
    """
    Scan full text for chronic conditions scispaCy misses.

    Respects:
      • Negation (no fever, denies, ruled out)
      • Historical context (previous, past, history of)
      • Uncertainty (possible, suspected)

    Args:
        text: Full clinical text (lowercase)
        seen_codes: Set of already-coded ICD codes to avoid duplicates

    Returns:
        (icd10_codes, diagnoses) tuples
    """
    text_lower = text.lower()
    sentences = re.split(r'[.\n]', text_lower)

    icd10_codes: list[str] = []
    diagnoses: list[str] = []

    for keyword, code in NER_FALLBACK_RULES.items():
        if code in seen_codes:
            continue

        for sentence in sentences:
            if keyword not in sentence:
                continue

            # Find position of keyword in original text for context checking
            match_pos = text_lower.find(keyword)
            if match_pos == -1:
                continue

            # Context filtering
            if _is_negated(text, match_pos):
                logger.debug("Skipping negated: %s", keyword)
                continue

            if _is_resolved_context(text, match_pos):
                logger.debug("Skipping resolved: %s", keyword)
                continue

            # Uncertainty doesn't disqualify, but note for confidence
            uncertain = _is_uncertain_context(text, match_pos)

            # Found affirmed, current condition
            seen_codes.add(code)
            icd10_codes.append(code)

            # Fetch description from MongoDB
            doc = _icd10_col().find_one({"code": code}, {"description": 1})
            desc = doc["description"] if doc else keyword.title()

            if uncertain:
                desc = f"[SUSPECTED] {desc}"

            diagnoses.append(desc)
            break

    return icd10_codes, diagnoses


def _apply_fallback_rules_explained(text: str, seen_codes: set) -> tuple[list, list, list]:
    """
    Scan full text for chronic conditions and return explainable evidence.

    Returns both codes/descriptions AND the original keywords used to match them.

    Args:
        text: Full clinical text (lowercase)
        seen_codes: Set of already-coded ICD codes to avoid duplicates

    Returns:
        (icd10_codes, diagnoses, evidences) tuples
    """
    text_lower = text.lower()
    sentences = re.split(r'[.\n]', text_lower)

    icd10_codes: list[str] = []
    diagnoses: list[str] = []
    evidences: list[str] = []

    for keyword, code in NER_FALLBACK_RULES.items():
        if code in seen_codes:
            continue

        for sentence in sentences:
            if keyword not in sentence:
                continue

            # Find position of keyword in original text for context checking
            match_pos = text_lower.find(keyword)
            if match_pos == -1:
                continue

            # Context filtering
            if _is_negated(text, match_pos):
                logger.debug("Skipping negated: %s", keyword)
                continue

            if _is_resolved_context(text, match_pos):
                logger.debug("Skipping resolved: %s", keyword)
                continue

            # Uncertainty doesn't disqualify, but note for confidence
            uncertain = _is_uncertain_context(text, match_pos)

            # Found affirmed, current condition
            seen_codes.add(code)
            icd10_codes.append(code)
            evidences.append(keyword)  # Track original keyword as evidence

            # Fetch description from MongoDB
            doc = _icd10_col().find_one({"code": code}, {"description": 1})
            desc = doc["description"] if doc else keyword.title()

            if uncertain:
                desc = f"[SUSPECTED] {desc}"

            diagnoses.append(desc)
            break

    return icd10_codes, diagnoses, evidences

def _normalize_fulltext_score(raw_score: float, max_score: float = 100.0) -> float:
    """Normalize MongoDB fulltext score to 0-1 range."""
    return min(1.0, raw_score / max_score) if max_score > 0 else 0.0


MIN_ICD_CONFIDENCE = 0.70
MIN_ICD_OUTPUT_CONFIDENCE = 0.10
TRAUMA_TERMS = (
    "motorcycle", "collision", "accident", "rear-end", "whiplash",
    "laceration", "injury", "wound", "trauma"
)
TRAUMA_CODE_PREFIXES = ("S", "T", "V", "W", "X")
P_RELEVANT_KEYWORDS = ("newborn", "neonatal", "birth injury", "infant", "delivery", "labor", "preterm")
O_RELEVANT_KEYWORDS = ("pregnancy", "pregnant", "maternal", "obstetric", "prenatal", "postpartum", "labor", "delivery")
Q_RELEVANT_KEYWORDS = ("congenital", "birth defect", "genetic", "abnormality", "syndrome", "hereditary")


def _boost_trauma_codes(code: str) -> float:
    """
    Apply trauma-specific relevance boost for injury codes.

    ICD codes S/T/V/W/X are trauma/injury and external cause codes.
    Boost them slightly when matching trauma concepts to prevent unrelated codes.

    Returns:
        0.1 for trauma codes, 0.0 for others
    """
    if code.startswith(("S", "T", "V", "W", "X")):
        return 0.1
    return 0.0


def _text_contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _is_trauma_context(text: str) -> bool:
    return _text_contains_any(text.lower(), TRAUMA_TERMS)


def _is_trauma_code(code: str) -> bool:
    return code.startswith(TRAUMA_CODE_PREFIXES)


def _validate_semantic_candidate(
    entity_text: str,
    context_text: str,
    code: str,
    description: str,
    semantic_score: float,
) -> tuple[bool, str]:
    """Validate a semantic ICD candidate before acceptance."""
    text = f"{entity_text} {context_text}".lower()

    if semantic_score < MIN_ICD_CONFIDENCE:
        return False, "LOW_CONFIDENCE"

    if code.startswith("P") and not _text_contains_any(text, P_RELEVANT_KEYWORDS):
        return False, "IRRELEVANT_CATEGORY"

    if code.startswith("O") and not _text_contains_any(text, O_RELEVANT_KEYWORDS):
        return False, "IRRELEVANT_CATEGORY"

    if code.startswith("Q") and not _text_contains_any(text, Q_RELEVANT_KEYWORDS):
        return False, "IRRELEVANT_CATEGORY"

    if _is_trauma_context(text) and not _is_trauma_code(code):
        return False, "SEMANTIC_MISMATCH"

    description_lower = description.lower()
    if _is_trauma_context(text) and "self-harm" in description_lower:
        return False, "SEMANTIC_MISMATCH"

    if _is_trauma_context(text) and "assault" in description_lower and not _text_contains_any(text, ("assault", "attack", "beaten", "violence", "shot", "stab")):
        return False, "SEMANTIC_MISMATCH"

    if "injur" in entity_text.lower() and code.startswith("P") and "birth" in description_lower:
        return False, "SEMANTIC_MISMATCH"

    return True, ""


def _match_icd10_candidates(entity_text: str, return_top_n: int = 3, context_text: str = "") -> list[ICDCandidate]:
    """
    Find ICD-10 candidates for entity with confidence scores.

    Returns top N candidates ranked by combined confidence.

    Args:
        entity_text: Clinical term to match
        return_top_n: Number of top candidates to return

    Returns:
        List of ICDCandidate objects sorted by confidence (highest first)
    """
    col = _icd10_col()
    text = entity_text.strip()
    candidates: list[ICDCandidate] = []

    # Tier 1a — Exact code match (exact_match = 1.0)
    result = col.find_one({"code": text.upper()})
    if not result:
        result = col.find_one({"code": text.upper().replace(".", "")})

    if result:
        candidate = ICDCandidate(
            code=result["code"],
            description=result.get("description", ""),
            exact_match=1.0,
            trauma_boost=_boost_trauma_codes(result["code"]),
        )
        candidate.calculate_confidence()
        candidates.append(candidate)

    # Tier 1b — Exact synonym match (exact_match = 0.95)
    if not candidates:
        result = col.find_one(
            {"synonyms": {"$regex": f"^{re.escape(text)}$", "$options": "i"}}
        )
        if result:
            candidate = ICDCandidate(
                code=result["code"],
                description=result.get("description", ""),
                exact_match=0.95,
                trauma_boost=_boost_trauma_codes(result["code"]),
            )
            candidate.calculate_confidence()
            candidates.append(candidate)

    # Tier 2 — Full-text search (fulltext_score = normalized MongoDB score)
    if not candidates:
        results = list(
            col.find(
                {"$text": {"$search": text}},
                {"score": {"$meta": "textScore"}, "code": 1, "description": 1},
            )
            .sort([("score", {"$meta": "textScore"})])
            .limit(return_top_n)
        )

        for result in results:
            score = _normalize_fulltext_score(result.get("score", 0))
            candidate = ICDCandidate(
                code=result["code"],
                description=result.get("description", ""),
                fulltext_score=score,
                trauma_boost=_boost_trauma_codes(result["code"]),
            )
            candidate.calculate_confidence()
            if candidate.final_confidence >= MIN_ICD_OUTPUT_CONFIDENCE:
                candidates.append(candidate)
            else:
                logger.warning(
                    "Rejected ICD candidate | code=%s | confidence=%s | reason=%s",
                    candidate.code,
                    round(candidate.final_confidence, 3),
                    "LOW_CONFIDENCE",
                )

    # Tier 3 — Semantic similarity (semantic_score + trauma_boost)
    if not candidates:
        result = find_best_icd10(text, _get_db())
        if result:
            semantic_score = result.get("score", 0.0)
            valid, reason = _validate_semantic_candidate(
                entity_text=text,
                context_text=context_text,
                code=result["code"],
                description=result.get("description", ""),
                semantic_score=semantic_score,
            )
            if not valid:
                logger.warning(
                    "Rejected ICD candidate | code=%s | confidence=%s | reason=%s",
                    result.get("code"),
                    round(semantic_score, 3),
                    reason,
                )
            else:
                candidate = ICDCandidate(
                    code=result["code"],
                    description=result.get("description", ""),
                    semantic_score=semantic_score,
                    trauma_boost=_boost_trauma_codes(result["code"]),
                )
                candidate.calculate_confidence()
                if candidate.final_confidence >= MIN_ICD_OUTPUT_CONFIDENCE:
                    candidates.append(candidate)
                else:
                    logger.warning(
                        "Rejected ICD candidate | code=%s | confidence=%s | reason=%s",
                        candidate.code,
                        round(candidate.final_confidence, 3),
                        "LOW_CONFIDENCE",
                    )

    # Sort by confidence (highest first) and return top N
    candidates.sort(key=lambda c: c.final_confidence, reverse=True)
    return candidates[:return_top_n]


def _match_icd10(entity_text: str, context_text: str = "") -> dict | None:
    """
    Find best ICD-10 match for entity (backward compatible).

    Returns the top-ranked candidate as a dict (for existing code compatibility).

    Args:
        entity_text: Clinical term to match
        context_text: Additional text context to validate category relevance

    Returns:
        Dict with code, description, score (or None if no match found)
    """
    candidates = _match_icd10_candidates(entity_text, return_top_n=1, context_text=context_text)

    if candidates:
        top = candidates[0]
        return {
            "code": top.code,
            "description": top.description,
            "score": top.final_confidence,
        }

    return None


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

def assign_codes(entities: list[dict], full_text: str = "", explain: bool = True) -> dict:
    """
    Map NLP entities to ICD-10 and CPT codes (4-tier approach).

    Pipeline:
      1. Trauma extraction (dedicated layer → semantic search)
      2. Generic entity matching (existing NER)
      3. Fallback rules (chronic conditions)
      4. CPT keyword scanning

    Args:
        entities:  Output of extract_entities() — affirmed, current entities only
        full_text: Full cleaned text for trauma, fallback rules, and CPT scanning
        explain:   If True, return explainable results (code/evidence/matchType);
                   if False, return legacy format (code strings only)

    Returns:
        If explain=True:
            {
                "icd10": [
                    {"code": "E11.9", "evidence": "Type 2 Diabetes", "matchType": "entity_match", "confidence": 0.95},
                    ...
                ],
                "cpt": [
                    {"code": "99213", "evidence": "office visit", "matchType": "keyword_scan", "confidence": 1.0},
                    ...
                ]
            }
        
        If explain=False (backward compatible):
            {
                "icd10": ["E11.9", "I10", ...],
                "cpt": ["99213", ...],
                "diagnosis": ["Type 2 Diabetes", "Hypertension", ...],
                "procedure": ["Office visit", ...]
            }
    """

    icd10_results: list[ICD10Result] = []
    cpt_results: list[CPTResult] = []

    icd10_codes: list[str] = []
    diagnoses: list[str] = []
    cpt_codes: list[str] = []
    procedures: list[str] = []

    seen_icd10: set[str] = set()
    seen_cpt: set[str] = set()

    # ── TIER 4: TRAUMA EXTRACTION LAYER ───────────────────────────────────────
    logger.debug("Starting trauma extraction...")
    trauma_entities = extract_trauma_entities(full_text)
    trauma_entities = [e.to_dict() for e in trauma_entities]
    trauma_entities = deduplicate_trauma_concepts(trauma_entities)

    for trauma_entity in trauma_entities:
        concept = trauma_entity.get("concept", "")
        body_part = trauma_entity.get("body_part")
        original_text = trauma_entity.get("text", concept)

        # Construct search term: include body part if known
        search_term = f"{concept} {body_part}".strip() if body_part else concept

        logger.debug(f"Searching trauma concept: {search_term}")
        match = _match_icd10(search_term, full_text)

        if match:
            code = match["code"]
            if code not in seen_icd10:
                seen_icd10.add(code)
                
                if explain:
                    result = ICD10Result(
                        code=code,
                        evidence=original_text,
                        matchType="trauma_match",
                        confidence=match.get("score", 1.0)
                    )
                    icd10_results.append(result)
                else:
                    icd10_codes.append(code)
                    diagnoses.append(match["description"])
                
                logger.info(f"Trauma match: {concept} → {code}")
        else:
            logger.debug(f"No ICD match for trauma concept: {concept}")

    # ── TIER 1: ICD-10 FROM NER ENTITIES ──────────────────────────────────────
    for entity in entities:
        text = entity.get("text", "")
        label = entity.get("label", "")

        if label not in ("DISEASE", "CHEMICAL", ""):
            continue

        match = _match_icd10(text, full_text)
        if match:
            code = match["code"]
            if code not in seen_icd10:
                seen_icd10.add(code)
                
                if explain:
                    result = ICD10Result(
                        code=code,
                        evidence=text,
                        matchType="entity_match",
                        confidence=match.get("score", 1.0)
                    )
                    icd10_results.append(result)
                else:
                    icd10_codes.append(code)
                    diagnoses.append(match["description"])
        else:
            logger.debug("No ICD-10 match for: '%s'", text)

    # ── TIER 2: ICD-10 FALLBACK RULES (chronic conditions) ────────────────────
    fallback_codes, fallback_diagnoses, fallback_evidences = _apply_fallback_rules_explained(
        full_text, seen_icd10
    )
    
    if explain:
        for code, evidence in zip(fallback_codes, fallback_evidences):
            result = ICD10Result(
                code=code,
                evidence=evidence,
                matchType="fallback_rule",
                confidence=1.0
            )
            icd10_results.append(result)
    else:
        icd10_codes.extend(fallback_codes)
        diagnoses.extend(fallback_diagnoses)

    # ── TIER 3: CPT FROM FULL TEXT KEYWORD SCAN ──────────────────────────────
    text_lower = full_text.lower()

    for keyword in CPT_SCAN_KEYWORDS:
        if keyword not in text_lower:
            continue

        match = _match_cpt(keyword)
        if match:
            code = match["code"]
            if code not in seen_cpt:
                seen_cpt.add(code)
                
                if explain:
                    result = CPTResult(
                        code=code,
                        evidence=keyword,
                        matchType="keyword_scan",
                        confidence=1.0
                    )
                    cpt_results.append(result)
                else:
                    cpt_codes.append(code)
                    procedures.append(match["description"])

    # ── FALLBACK DEFAULTS ────────────────────────────────────────────────────
    if explain:
        if not icd10_results:
            icd10_results.append(
                ICD10Result(
                    code="Z00.00",
                    evidence="No conditions found",
                    matchType="default",
                    confidence=1.0
                )
            )
        
        if not cpt_results:
            cpt_results.append(
                CPTResult(
                    code="99213",
                    evidence="Office visit (default)",
                    matchType="default",
                    confidence=1.0
                )
            )

        return {
            "icd10": [r.to_dict() for r in icd10_results],
            "cpt": [r.to_dict() for r in cpt_results],
        }
    else:
        if not icd10_codes:
            icd10_codes = ["Z00.00"]
            diagnoses = ["Encounter for general examination without abnormal findings"]

        if not cpt_codes:
            cpt_codes = ["99213"]
            procedures = ["Office or other outpatient visit, established patient"]

        return {
            "icd10": icd10_codes,
            "cpt": cpt_codes,
            "diagnosis": diagnoses,
            "procedure": procedures,
        }