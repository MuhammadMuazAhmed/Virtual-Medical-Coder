"""
nlp_service.py
─────────────────────────────────────────────────────────────────────────────
Thin wrapper — delegates to processors/entity_extractor.py and processors/icd_mapper.py.
Provides a single run_nlp() entrypoint for the API with explain parameter.
"""

from processors.entity_extractor import extract_entities
from processors.icd_mapper import assign_codes


def run_nlp(text: str, explain: bool = True) -> dict:
    """
    Extract entities from text and assign ICD-10/CPT codes.

    Args:
        text: Clinical text to process
        explain: If True, return explainable results (code + evidence + matchType);
                 if False, return legacy format (code strings only)

    Returns:
        Structured result dict with icd10/cpt (and optional diagnosis/procedure)
    """
    entities = extract_entities(text)
    return assign_codes(entities, full_text=text, explain=explain)


__all__ = ["extract_entities", "run_nlp"]