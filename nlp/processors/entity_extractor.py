"""
entity_extractor.py
─────────────────────────────────────────────────────────────────────────────
Loads scispaCy model and extracts medical entities from clinical text.
Called by nlp_service.py.
"""

from __future__ import annotations

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _load_model():
    """
    Load scispaCy model once and cache it for the process lifetime.
    Falls back to en_core_web_sm if medical model is not installed.
    """
    try:
        import spacy
        nlp = spacy.load("en_ner_bc5cdr_md")
        logger.info("Loaded scispaCy model: en_ner_bc5cdr_md")
        return nlp
    except OSError:
        logger.warning(
            "en_ner_bc5cdr_md not found — falling back to en_core_web_sm.\n"
            "Install the medical model:\n"
            "  pip install https://s3-us-west-2.amazonaws.com/ai-neuro-scispacy/"
            "releases/v0.5.5/en_ner_bc5cdr_md-0.5.5.tar.gz"
        )
        import spacy
        return spacy.load("en_core_web_sm")


def _dedupe(entities: list[dict]) -> list[dict]:
    """
    Remove duplicate or near-duplicate entities.
    If one entity text is a substring of another, keep the longer one.
    """
    sorted_ents = sorted(entities, key=lambda e: len(e["text"]), reverse=True)
    seen: list[dict] = []

    for ent in sorted_ents:
        text_lower = ent["text"].lower()
        dominated = any(
            text_lower in s["text"].lower() or s["text"].lower() in text_lower
            for s in seen
        )
        if not dominated:
            seen.append(ent)

    return seen


def extract_entities(text: str) -> list[dict]:
    """
    Extract medical entities from clinical text.

    Returns:
    [
        {"text": "Diabetes Mellitus", "label": "DISEASE"},
        {"text": "Metformin",         "label": "CHEMICAL"},
        ...
    ]
    """
    if not text or not text.strip():
        return []

    nlp = _load_model()
    doc = nlp(text)

    # Skip clearly non-medical labels from fallback model
    skip_labels = {"ORG", "GPE", "PERSON", "DATE", "TIME", "CARDINAL", "ORDINAL", "MONEY"}

    entities = [
        {"text": ent.text.strip(), "label": ent.label_}
        for ent in doc.ents
        if len(ent.text.strip()) > 2 and ent.label_ not in skip_labels
    ]

    return _dedupe(entities)