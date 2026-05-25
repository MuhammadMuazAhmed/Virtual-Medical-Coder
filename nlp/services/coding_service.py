"""
coding_service.py
─────────────────────────────────────────────────────────────────────────────
Thin wrapper — delegates to processors/mapper.py.
Import assign_codes from here throughout the app.
"""

from processors.mapper import assign_codes

__all__ = ["assign_codes"]