"""
coding_service.py
─────────────────────────────────────────────────────────────────────────────
Thin wrapper — delegates to processors/icd_mapper.py.
Import assign_codes from here throughout the app.
"""

from processors.icd_mapper import assign_codes

__all__ = ["assign_codes"]