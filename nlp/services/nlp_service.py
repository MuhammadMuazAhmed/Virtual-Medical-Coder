"""
nlp_service.py
─────────────────────────────────────────────────────────────────────────────
Thin wrapper — delegates to processors/entity_extractor.py.
Import extract_entities from here throughout the app.
"""

from processors.entity_extractor import extract_entities

__all__ = ["extract_entities"]