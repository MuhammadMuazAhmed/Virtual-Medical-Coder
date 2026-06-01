"""
semantic_matcher.py
─────────────────────────────────────────────────────────────────────────────
Uses sentence-transformers to find the best ICD-10/CPT code match
by semantic similarity when exact/synonym/text search fails.

This is the final fallback in the matching pipeline — it understands
meaning rather than just keywords, so "sugar disease" still maps to
"Type 2 diabetes mellitus" correctly.

Usage:
    from processors.semantic_matcher import find_best_icd10, find_best_cpt
    result = find_best_icd10("sugar disease", db)
"""

from __future__ import annotations

import logging
import numpy as np
from functools import lru_cache

logger = logging.getLogger(__name__)

# Minimum similarity score to accept a match (0.0 - 1.0)
# Below this threshold, no code is assigned
SIMILARITY_THRESHOLD = 0.55


# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING
# ─────────────────────────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_model():
    """
    Load sentence-transformers model once and cache it.
    Uses a small but accurate biomedical model.
    """
    from sentence_transformers import SentenceTransformer
    logger.info("Loading sentence-transformers model...")
    # This model is trained on biomedical text — much better than general models
    model = SentenceTransformer("pritamdeka/S-PubMedBert-MS-MARCO")
    logger.info("Sentence-transformers model loaded.")
    return model


# ─────────────────────────────────────────────────────────────────────────────
# SIMILARITY SEARCH
# ─────────────────────────────────────────────────────────────────────────────

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Compute cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def _semantic_search(
    query: str,
    collection,
    limit: int = 500,
    threshold: float = SIMILARITY_THRESHOLD,
) -> dict | None:
    """
    Find best matching document in a MongoDB collection using semantic similarity.

    Strategy:
    1. Fetch top candidates using MongoDB text search (fast pre-filter)
    2. Re-rank candidates using sentence-transformers embeddings
    3. Return best match above threshold

    Args:
        query:      Entity text to match
        collection: MongoDB collection (icd10_codes or cpt_codes)
        limit:      Number of text-search candidates to re-rank
        threshold:  Minimum cosine similarity to accept

    Returns:
        Best matching document or None
    """
    model = _load_model()

    # Step 1 — Get candidates via MongoDB text search
    try:
        candidates = list(
            collection.find(
                {"$text": {"$search": query}},
                {"score": {"$meta": "textScore"}, "code": 1, "description": 1}
            )
            .sort([("score", {"$meta": "textScore"})])
            .limit(limit)
        )
    except Exception as e:
        logger.warning("MongoDB text search failed: %s", e)
        candidates = []

    if not candidates:
        return None

    # Step 2 — Encode query and candidates
    query_embedding = model.encode(query, convert_to_numpy=True)

    descriptions = [c["description"] for c in candidates]
    candidate_embeddings = model.encode(descriptions, convert_to_numpy=True, batch_size=64)

    # Step 3 — Find best match
    best_score = -1.0
    best_match = None

    for i, candidate in enumerate(candidates):
        score = _cosine_similarity(query_embedding, candidate_embeddings[i])
        if score > best_score:
            best_score = score
            best_match = candidate

    if best_score >= threshold:
        logger.debug(
            "Semantic match: '%s' → '%s' (%s) score=%.3f",
            query, best_match["description"], best_match["code"], best_score
        )
        return best_match

    logger.debug(
        "No semantic match above threshold for '%s' (best=%.3f)", query, best_score
    )
    return None


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def find_best_icd10(entity_text: str, db) -> dict | None:
    """
    Find best ICD-10 code for entity_text using semantic similarity.

    Args:
        entity_text: Medical entity text
        db:          MongoDB database object

    Returns:
        Matching document { code, description } or None
    """
    return _semantic_search(entity_text, db["icd10_codes"])


def find_best_cpt(keyword: str, db) -> dict | None:
    """
    Find best CPT code for keyword using semantic similarity.

    Args:
        keyword: Procedure keyword
        db:      MongoDB database object

    Returns:
        Matching document { code, description } or None
    """
    return _semantic_search(keyword, db["cpt_codes"])