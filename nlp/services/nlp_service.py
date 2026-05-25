"""
nlp_service.py
─────────────────────────────────────────────────────────────────────────────
Thin wrapper — delegates to processors/entity_extractor.py and processors/icd_mapper.py.
Provides a single run_nlp() entrypoint for the API.
"""

from processors.entity_extractor import extract_entities
from processors.icd_mapper import assign_codes


def run_nlp(text: str) -> dict:
    """Extract entities from text and assign ICD-10/CPT codes."""
    entities = extract_entities(text)
    return assign_codes(entities, full_text=text)


__all__ = ["extract_entities", "run_nlp"]