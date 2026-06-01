"""
section_classifier.py
─────────────────────────────────────────────────────────────────────────────
Splits clinical text into named sections and returns only the sections
relevant for active diagnosis coding.

Relevant sections  → extract entities + assign codes
Irrelevant sections → skip (past history, family history, social history)

Usage:
    from processors.section_classifier import extract_coding_text
    coding_text = extract_coding_text(full_clinical_text)
"""

from __future__ import annotations
import re

# ─────────────────────────────────────────────────────────────────────────────
# SECTION DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

# Sections we WANT to extract entities from
RELEVANT_SECTIONS = {
    "chief_complaint",
    "history_of_present_illness",
    "assessment",
    "plan",
    "assessment_and_plan",
    "diagnoses",
    "current_medications",
    "physical_examination",
    "investigations",
    "follow_up",
}

# Sections we IGNORE for coding
IRRELEVANT_SECTIONS = {
    "past_medical_history",
    "past_history",
    "family_history",
    "social_history",
    "surgical_history",
    "allergies",
    "immunization_history",
    "review_of_systems",
}

# Pattern map: regex → section key
# Order matters — more specific patterns first
SECTION_PATTERNS: list[tuple[str, str]] = [

    # Assessment & Plan
    (r"assessment\s*and\s*plan",         "assessment_and_plan"),
    (r"assessment\s*/\s*plan",           "assessment_and_plan"),
    (r"\bassessment\b",                  "assessment"),
    (r"\bplan\b",                        "plan"),
    (r"\bdiagnos[ei]s\b",               "diagnoses"),
    (r"\bimpression\b",                  "assessment"),

    # Chief Complaint / HPI
    (r"chief\s*complaint",               "chief_complaint"),
    (r"presenting\s*complaint",          "chief_complaint"),
    (r"reason\s*for\s*visit",            "chief_complaint"),
    (r"history\s*of\s*present\s*illness","history_of_present_illness"),
    (r"\bhpi\b",                         "history_of_present_illness"),

    # Current state
    (r"current\s*medications?",          "current_medications"),
    (r"medications?\s*on\s*admission",   "current_medications"),
    (r"physical\s*exam(?:ination)?",     "physical_examination"),
    (r"vital\s*signs?",                  "physical_examination"),
    (r"investigations?\s*ordered",       "investigations"),
    (r"laboratory\s*results?",           "investigations"),
    (r"lab\s*results?",                  "investigations"),
    (r"follow[\s\-]*up",                 "follow_up"),

    # Irrelevant
    (r"past\s*medical\s*history",        "past_medical_history"),
    (r"past\s*history",                  "past_history"),
    (r"previous\s*history",              "past_history"),
    (r"family\s*history",                "family_history"),
    (r"social\s*history",                "social_history"),
    (r"surgical\s*history",              "surgical_history"),
    (r"known\s*allergies",               "allergies"),
    (r"\ballergies\b",                   "allergies"),
    (r"immunization\s*history",          "immunization_history"),
    (r"review\s*of\s*systems?",          "review_of_systems"),
]


# ─────────────────────────────────────────────────────────────────────────────
# SECTION SPLITTER
# ─────────────────────────────────────────────────────────────────────────────

def _identify_section(heading: str) -> str:
    """Map a heading string to a section key."""
    heading_lower = heading.lower().strip()
    for pattern, section_key in SECTION_PATTERNS:
        if re.search(pattern, heading_lower):
            return section_key
    return "unknown"


def split_sections(text: str) -> dict[str, str]:
    """
    Split clinical text into sections.

    Returns a dict: { section_key: section_text }

    Headings are detected as lines that:
    - Are in ALL CAPS, or
    - End with a colon, or
    - Match known section patterns
    """
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")

    sections: dict[str, str] = {}
    current_section = "unknown"
    current_lines: list[str] = []

    heading_pattern = re.compile(
        r"^(?:[A-Z][A-Z\s/&\-]{3,}|.{4,}:)\s*$"
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_lines.append("")
            continue

        # Check if this line is a section heading
        is_heading = (
            heading_pattern.match(stripped)
            or stripped.endswith(":")
            or stripped.isupper()
        )

        if is_heading:
            # Save current section
            if current_lines:
                sections[current_section] = sections.get(current_section, "") + "\n".join(current_lines) + "\n"
                current_lines = []

            # Identify new section
            current_section = _identify_section(stripped.rstrip(":"))
        else:
            current_lines.append(stripped)

    # Save last section
    if current_lines:
        sections[current_section] = sections.get(current_section, "") + "\n".join(current_lines)

    return sections


# ─────────────────────────────────────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────────────────────────────────────

def extract_coding_text(text: str) -> str:
    """
    Extract and return only the text from sections relevant for coding.

    Skips: Past Medical History, Family History, Social History,
           Surgical History, Allergies, Review of Systems.

    Returns concatenated text from relevant sections only.
    """
    sections = split_sections(text)

    relevant_parts: list[str] = []

    for section_key, section_text in sections.items():
        if section_key in RELEVANT_SECTIONS or section_key == "unknown":
            relevant_parts.append(section_text.strip())

    result = "\n\n".join(p for p in relevant_parts if p)
    return result if result else text  # fallback to full text if nothing detected