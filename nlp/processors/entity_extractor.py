"""
entity_extractor.py
─────────────────────────────────────────────────────────────────────────────
Full clinical NLP pipeline:

  1. Section classification  — extract only coding-relevant sections
  2. Abbreviation expansion  — HTN → hypertension, SOB → shortness of breath
  3. NER                     — en_ner_bc5cdr_md (DISEASE + CHEMICAL entities)
  4. Context filtering       — medspaCy ConText removes:
                               negated, historical, hypothetical, family entities
  5. Deduplication           — remove substring duplicates

Called by nlp_service.py.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from processors.abbreviation_expander import expand_abbreviations
from processors.section_classifier import extract_coding_text

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_pipeline():
    """
    Build and cache the full medspaCy pipeline.

    Components:
      - en_ner_bc5cdr_md   : scispaCy model for DISEASE + CHEMICAL NER
      - medspacy_context   : ConText algorithm for negation/historical/hypothetical
    """
    import spacy
    import medspacy

    try:
        nlp = spacy.load("en_ner_bc5cdr_md")
        logger.info("Loaded NER model: en_ner_bc5cdr_md")
    except OSError:
        logger.warning("en_ner_bc5cdr_md not found — falling back to en_core_web_sm")
        nlp = spacy.load("en_core_web_sm")

    # Add medspaCy context component for negation + historical + hypothetical detection
    nlp.add_pipe("medspacy_context")
    logger.info("medspaCy context component added.")

    return nlp


# ─────────────────────────────────────────────────────────────────────────────
# CONTEXT FILTER
# ─────────────────────────────────────────────────────────────────────────────

def _is_valid(ent) -> bool:
    """
    Return True only if entity should be coded.
    Filters out negated, historical, hypothetical, and family context entities.
    """
    try:
        if ent._.is_negated:
            logger.debug("Skipping negated: '%s'", ent.text)
            return False
        if ent._.is_historical:
            logger.debug("Skipping historical: '%s'", ent.text)
            return False
        if ent._.is_hypothetical:
            logger.debug("Skipping hypothetical: '%s'", ent.text)
            return False
        if ent._.is_family:
            logger.debug("Skipping family: '%s'", ent.text)
            return False
        return True
    except AttributeError:
        # medspaCy context attributes not available — accept all
        return True


# ─────────────────────────────────────────────────────────────────────────────
# DEDUPLICATION
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def extract_entities(text: str) -> list[dict]:
    """
    Full pipeline:
      section filter → abbreviation expansion → NER → context filter → dedupe

    Returns only affirmed, current, non-family entities:
    [
        {"text": "type 2 diabetes mellitus", "label": "DISEASE"},
        {"text": "metformin",                "label": "CHEMICAL"},
        ...
    ]
    """
    if not text or not text.strip():
        return []

    # ── Step 1: Extract only coding-relevant sections ─────────────────────────
    coding_text = extract_coding_text(text)
    logger.debug("Coding text: %d chars (original: %d)", len(coding_text), len(text))

    # ── Step 2: Expand abbreviations ──────────────────────────────────────────
    expanded_text = expand_abbreviations(coding_text)

    # ── Step 3: NER ───────────────────────────────────────────────────────────
    nlp = _load_pipeline()
    doc = nlp(expanded_text)

    # Skip non-medical labels from fallback model
    skip_labels = {"ORG", "GPE", "PERSON", "DATE", "TIME", "CARDINAL", "ORDINAL", "MONEY", "LOC"}

    # ── Step 4: Context filter ────────────────────────────────────────────────
    entities: list[dict] = []

    for ent in doc.ents:
        text_clean = ent.text.strip()

        if len(text_clean) <= 2:
            continue
        if ent.label_ in skip_labels:
            continue
        if not _is_valid(ent):
            continue

        entities.append({
            "text":  text_clean,
            "label": ent.label_,
        })

    # ── Step 5: Deduplicate ───────────────────────────────────────────────────
    return _dedupe(entities)