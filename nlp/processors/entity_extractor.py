"""
entity_extractor.py
─────────────────────────────────────────────────────────────────────────────
Full clinical NLP pipeline:

  1. Section classification  — extract only coding-relevant sections
  2. Negation preprocessor   — handle bullet/colon patterns medspaCy misses
  3. Abbreviation expansion  — HTN → hypertension, SOB → shortness of breath
  4. NER                     — en_ner_bc5cdr_md (DISEASE + CHEMICAL entities)
  5. Context filtering       — medspaCy ConText removes:
                               negated, historical, hypothetical, family entities
  6. Deduplication           — remove substring duplicates
"""

from __future__ import annotations

import logging
import re
from functools import lru_cache

from processors.abbreviation_expander import expand_abbreviations
from processors.section_classifier import extract_coding_text

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# NEGATION PREPROCESSOR
# Handles patterns medspaCy misses due to colons and bullet points
# e.g. "Extremities: No edema" / "• No pedal edema"
# ─────────────────────────────────────────────────────────────────────────────

# Patterns that indicate negation in structured clinical text
NEGATION_PATTERNS = [
    # "No X" after colon: "Extremities: No edema"
    r':\s*[Nn]o\s+\w+',
    # Bullet + No: "• No edema" or "- No fever"
    r'[•\-\*]\s*[Nn]o\s+\w+',
    # "Denies X" standalone
    r'[Dd]enies\s+\w+',
    # "No known X"
    r'[Nn]o\s+known\s+\w+',
    # "without X"
    r'[Ww]ithout\s+\w+',
]

def _extract_negated_terms(text: str) -> set[str]:
    """
    Extract terms that are negated via bullet/colon patterns.
    Returns a set of lowercased negated terms.
    """
    negated = set()
    for pattern in NEGATION_PATTERNS:
        for match in re.finditer(pattern, text):
            # Extract the last word(s) from the match as the negated term
            words = match.group().lower().split()
            # Skip negation keywords themselves
            skip = {"no", "not", "denies", "deny", "without", "known", ":", "•", "-", "*"}
            terms = [w for w in words if w not in skip]
            if terms:
                negated.add(terms[-1])
                if len(terms) >= 2:
                    negated.add(" ".join(terms[-2:]))
    return negated


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_pipeline():
    """
    Build and cache the full medspaCy pipeline.
    """
    import spacy
    import medspacy

    try:
        nlp = spacy.load("en_ner_bc5cdr_md")
        logger.info("Loaded NER model: en_ner_bc5cdr_md")
    except OSError:
        logger.warning("en_ner_bc5cdr_md not found — falling back to en_core_web_sm")
        nlp = spacy.load("en_core_web_sm")

    nlp.add_pipe("medspacy_context")
    logger.info("medspaCy context component added.")

    return nlp


# ─────────────────────────────────────────────────────────────────────────────
# CONTEXT FILTER
# ─────────────────────────────────────────────────────────────────────────────

def _is_valid(ent, negated_terms: set) -> bool:
    """
    Return True only if entity should be coded.
    Checks both medspaCy context AND our custom negation preprocessor.
    """
    text_lower = ent.text.lower().strip()

    # Check custom negation preprocessor first
    if any(text_lower in neg or neg in text_lower for neg in negated_terms):
        logger.debug("Skipping preprocessor-negated: '%s'", ent.text)
        return False

    # Check medspaCy context
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
    except AttributeError:
        pass

    return True


# ─────────────────────────────────────────────────────────────────────────────
# DEDUPLICATION
# ─────────────────────────────────────────────────────────────────────────────

def _dedupe(entities: list[dict]) -> list[dict]:
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
      section filter → negation preprocess → abbreviation expansion
      → NER → context filter → dedupe

    Returns only affirmed, current, non-family entities.
    """
    if not text or not text.strip():
        return []

    # ── Step 1: Extract only coding-relevant sections ─────────────────────────
    coding_text = extract_coding_text(text)

    # ── Step 2: Extract negated terms from bullet/colon patterns ─────────────
    negated_terms = _extract_negated_terms(coding_text)
    logger.debug("Preprocessor negated terms: %s", negated_terms)

    # ── Step 3: Expand abbreviations ──────────────────────────────────────────
    expanded_text = expand_abbreviations(coding_text)

    # ── Step 4: NER ───────────────────────────────────────────────────────────
    nlp = _load_pipeline()
    doc = nlp(expanded_text)

    skip_labels = {"ORG", "GPE", "PERSON", "DATE", "TIME", "CARDINAL", "ORDINAL", "MONEY", "LOC"}

    # ── Step 5: Context filter ────────────────────────────────────────────────
    entities: list[dict] = []

    for ent in doc.ents:
        text_clean = ent.text.strip()

        if len(text_clean) <= 2:
            continue
        if ent.label_ in skip_labels:
            continue
        if not _is_valid(ent, negated_terms):
            continue

        entities.append({
            "text":  text_clean,
            "label": ent.label_,
        })

    # ── Step 6: Deduplicate ───────────────────────────────────────────────────
    return _dedupe(entities)