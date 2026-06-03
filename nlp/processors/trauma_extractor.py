"""
trauma_extractor.py
─────────────────────────────────────────────────────────────────────────────
Dedicated trauma and injury extraction layer.

Detects trauma-related clinical concepts and returns standardized trauma entities
for proper ICD-10 routing through the semantic matching pipeline instead of
hardcoded codes.

Returns:
    [
        {
            "text": "whiplash",
            "concept": "Whiplash Injury",
            "type": "TRAUMA",
            "severity": "unspecified",
            "body_part": None,  # None until explicitly mentioned
            "start": 10,
            "end": 18
        }
    ]
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class TraumaEntity:
    """Standardized trauma entity."""
    text: str
    concept: str
    entity_type: str
    severity: str
    body_part: str | None
    start: int
    end: int

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "concept": self.concept,
            "type": self.entity_type,
            "severity": self.severity,
            "body_part": self.body_part,
            "start": self.start,
            "end": self.end,
        }


# ─────────────────────────────────────────────────────────────────────────────
# TRAUMA CONCEPT MAPPINGS
# ─────────────────────────────────────────────────────────────────────────────
# Maps keywords/patterns to medical concepts (not direct ICD codes).
# These concepts are passed to _match_icd10() for proper searching.

TRAUMA_CONCEPTS: dict[str, str] = {
    # Motor Vehicle Accidents
    "motorcycle accident": "Motorcycle Accident",
    "motor cycle accident": "Motorcycle Accident",
    "motor vehicle accident": "Motor Vehicle Collision",
    "motor vehicle collision": "Motor Vehicle Collision",
    "mva": "Motor Vehicle Collision",
    "car accident": "Motor Vehicle Collision",
    "motor vehicle": "Motor Vehicle Collision",
    "rear-end collision": "Motor Vehicle Collision, Rear End",
    "rear end collision": "Motor Vehicle Collision, Rear End",
    "head-on collision": "Motor Vehicle Collision, Head-On",
    "t-bone": "Motor Vehicle Collision",
    "rollover": "Motor Vehicle Collision",
    "hit by vehicle": "Pedestrian Hit by Motor Vehicle",
    "pedestrian struck": "Pedestrian Hit by Motor Vehicle",
    "struck by car": "Pedestrian Hit by Motor Vehicle",
    "hit and run": "Motor Vehicle Collision",
    "road traffic accident": "Road Traffic Accident",
    "rta": "Road Traffic Accident",

    # Workplace and Industrial Injuries
    "workplace injury": "Workplace Injury",
    "occupational injury": "Workplace Injury",
    "industrial accident": "Industrial Accident",
    "factory accident": "Industrial Accident",
    "machinery accident": "Industrial Accident",
    "crush injury": "Crush Injury",
    "crushed": "Crush Injury",

    # Fall-Related
    "slip and fall": "Fall from Slipping",
    "trip and fall": "Fall from Tripping",
    "fall": "Fall",
    "fell": "Fall",
    "fallen": "Fall",
    "fall from height": "Fall from Height",
    "fall from ladder": "Fall from Height",
    "fall downstairs": "Fall Downstairs",
    "fall down stairs": "Fall Downstairs",
    "fall off": "Fall from Height",

    # Sports Injuries
    "sports injury": "Sports Injury",
    "sports-related injury": "Sports Injury",
    "athletic injury": "Sports Injury",
    "gym injury": "Sports Injury",
    "football injury": "Sports Injury",
    "basketball injury": "Sports Injury",
    "soccer injury": "Sports Injury",
    "running injury": "Sports Injury",

    # Farm/Agricultural
    "farm accident": "Farm Accident",
    "farm injury": "Farm Accident",
    "agricultural injury": "Farm Accident",

    # Assault/Abuse
    "assault": "Assault",
    "hit": "Assault",
    "beaten": "Assault",
    "punched": "Assault",
    "stabbed": "Penetrating Injury",
    "gunshot": "Gunshot Wound",
    "gsw": "Gunshot Wound",
    "abuse": "Assault",

    # General Trauma
    "trauma": "Trauma",
    "traumatic injury": "Trauma",
    "injury": "Injury",
    "blunt trauma": "Blunt Force Trauma",
    "blunt force": "Blunt Force Trauma",
    "penetrating trauma": "Penetrating Trauma",
    "penetrating injury": "Penetrating Trauma",

    # Specific Injury Types (Generic - no body part specified)
    "fracture": "Fracture",
    "fractured": "Fracture",
    "broken bone": "Fracture",
    "broken": "Fracture",
    "laceration": "Laceration",
    "lacerated": "Laceration",
    "deep cut": "Laceration",
    "deep laceration": "Laceration",
    "cut": "Laceration",
    "cutting": "Laceration",
    "open wound": "Open Wound",
    "wound": "Wound",
    "wounded": "Wound",
    "abrasion": "Abrasion",
    "abraded": "Abrasion",
    "scrape": "Abrasion",
    "scraped": "Abrasion",
    "contusion": "Contusion",
    "bruise": "Contusion",
    "bruised": "Contusion",
    "hematoma": "Hematoma",
    "swelling": "Contusion",
    "edema": "Edema",
    "sprain": "Sprain",
    "sprained": "Sprain",
    "strain": "Strain",
    "strained": "Strain",
    "dislocation": "Dislocation",
    "dislocated": "Dislocation",
    "subluxation": "Subluxation",
    "burn": "Burn",
    "burned": "Burn",
    "burned": "Burn",
    "burnt": "Burn",
    "thermal burn": "Thermal Burn",
    "chemical burn": "Chemical Burn",
    "scalding": "Thermal Burn",
    "scalded": "Thermal Burn",
    "whiplash": "Whiplash Injury",
    "whiplash injury": "Whiplash Injury",

    # Head/Neurological
    "head injury": "Head Injury",
    "concussion": "Concussion",
    "concussed": "Concussion",
    "traumatic brain injury": "Traumatic Brain Injury",
    "tbi": "Traumatic Brain Injury",
    "skull fracture": "Skull Fracture",

    # Bleeding/Vascular
    "internal bleeding": "Internal Bleeding",
    "hemorrhage": "Hemorrhage",
    "hemorrhaging": "Hemorrhage",
    "bleeding": "Bleeding",
    "bled": "Bleeding",
    "hematoma": "Hematoma",
    "subdural hematoma": "Subdural Hematoma",
    "epidural hematoma": "Epidural Hematoma",

    # Neck/Spinal
    "neck strain": "Neck Strain",
    "cervical strain": "Neck Strain",
    "whiplash": "Whiplash Injury",
    "spinal injury": "Spinal Injury",
    "vertebral fracture": "Vertebral Fracture",
}

# Body parts that may appear with injury keywords
BODY_PARTS: dict[str, str] = {
    "head": "head",
    "face": "face",
    "jaw": "jaw",
    "tooth": "tooth",
    "teeth": "teeth",
    "eye": "eye",
    "eyes": "eyes",
    "ear": "ear",
    "ears": "ears",
    "nose": "nose",
    "mouth": "mouth",
    "lip": "lip",
    "lips": "lips",
    "tongue": "tongue",
    "throat": "throat",
    "neck": "neck",
    "shoulder": "shoulder",
    "shoulders": "shoulders",
    "arm": "arm",
    "arms": "arms",
    "forearm": "forearm",
    "wrist": "wrist",
    "wrists": "wrists",
    "hand": "hand",
    "hands": "hands",
    "finger": "finger",
    "fingers": "fingers",
    "thumb": "thumb",
    "chest": "chest",
    "thorax": "thorax",
    "rib": "rib",
    "ribs": "ribs",
    "back": "back",
    "spine": "spine",
    "vertebra": "spine",
    "abdomen": "abdomen",
    "abdominal": "abdomen",
    "stomach": "abdomen",
    "belly": "abdomen",
    "pelvis": "pelvis",
    "pelvic": "pelvis",
    "hip": "hip",
    "hips": "hips",
    "groin": "groin",
    "leg": "leg",
    "legs": "legs",
    "thigh": "thigh",
    "thighs": "thighs",
    "knee": "knee",
    "knees": "knees",
    "shin": "shin",
    "shins": "shins",
    "calf": "calf",
    "calves": "calf",
    "ankle": "ankle",
    "ankles": "ankles",
    "foot": "foot",
    "feet": "feet",
    "toe": "toe",
    "toes": "toes",
    "heel": "heel",
    "genitals": "genitals",
    "genital": "genitals",
    "genito-urinary": "genitals",
    "liver": "liver",
    "kidney": "kidney",
    "kidneys": "kidneys",
    "spleen": "spleen",
}

# Severity modifiers
SEVERITY_MODIFIERS: dict[str, str] = {
    "severe": "severe",
    "severely": "severe",
    "serious": "severe",
    "major": "severe",
    "moderate": "moderate",
    "moderately": "moderate",
    "mild": "mild",
    "minor": "mild",
    "slight": "mild",
    "minimal": "mild",
    "deep": "severe",
    "open": "severe",
    "closed": "moderate",
    "simple": "mild",
    "compound": "severe",
    "comminuted": "severe",
    "multiple": "severe",
}

# Context filters (skip if found before the injury keyword in same sentence)
RESOLVED_MARKERS: tuple[str, ...] = (
    "resolved",
    "resolved from",
    "recovered from",
    "recovered",
    "healed from",
    "healing",
    "healed",
    "fully healed",
    "well-healed",
    "old",
    "prior",
    "previous",
    "history of",
    "history of",
    "past medical history",
    "pmh",
    "past",
)


def extract_body_part_context(text: str, keyword_start: int, keyword_end: int, window: int = 50) -> str | None:
    """
    Check within a window around the keyword for explicit body part mentions.

    Args:
        text: Full text
        keyword_start: Start position of keyword
        keyword_end: End position of keyword
        window: Character window to search before/after

    Returns:
        Body part name if found, None otherwise
    """
    start = max(0, keyword_start - window)
    end = min(len(text), keyword_end + window)
    context_text = text[start:end].lower()

    for body_part_key in BODY_PARTS:
        if body_part_key in context_text:
            return BODY_PARTS[body_part_key]

    return None


def extract_severity(text: str, keyword_start: int, keyword_end: int, window: int = 30) -> str:
    """
    Check for severity modifiers around the keyword.

    Args:
        text: Full text
        keyword_start: Start position of keyword
        keyword_end: End position of keyword
        window: Character window to search before/after

    Returns:
        Severity level ("mild", "moderate", "severe", or "unspecified")
    """
    start = max(0, keyword_start - window)
    end = min(len(text), keyword_end + window)
    context_text = text[start:end].lower()

    for modifier_key, severity in SEVERITY_MODIFIERS.items():
        if modifier_key in context_text:
            return severity

    return "unspecified"


def is_context_resolved(text: str, keyword_start: int) -> bool:
    """
    Check if the injury is marked as resolved/historical before the keyword.

    Args:
        text: Full text
        keyword_start: Start position of keyword

    Returns:
        True if context suggests this is resolved/historical, False otherwise
    """
    # Look back up to sentence boundary or 100 characters
    sentence_start = text.rfind(".", 0, keyword_start) + 1
    context_before = text[sentence_start:keyword_start].lower()

    for marker in RESOLVED_MARKERS:
        if marker in context_before:
            return True

    return False


def extract_trauma_entities(text: str) -> list[TraumaEntity]:
    """
    Scan text for trauma-related keywords and extract standardized trauma entities.

    Returns:
        List of TraumaEntity objects with concept, severity, and body part context.
    """
    entities: list[TraumaEntity] = []
    text_lower = text.lower()

    # Track processed positions to avoid overlaps
    processed_ranges = set()

    for keyword, concept in TRAUMA_CONCEPTS.items():
        # Case-insensitive search
        pattern = r"\b" + re.escape(keyword) + r"\b"
        for match in re.finditer(pattern, text_lower):
            start, end = match.span()

            # Skip if overlaps with already processed entity
            if any(start <= p <= end or p in range(start, end) for p in processed_ranges):
                continue

            # Check if this trauma indicator is marked as resolved/historical
            if is_context_resolved(text, start):
                continue

            # Extract surrounding context
            body_part = extract_body_part_context(text, start, end)
            severity = extract_severity(text, start, end)

            entity = TraumaEntity(
                text=match.group(),
                concept=concept,
                entity_type="TRAUMA",
                severity=severity,
                body_part=body_part,
                start=start,
                end=end,
            )

            entities.append(entity)

            # Mark this range as processed
            for i in range(start, end):
                processed_ranges.add(i)

    return entities


def deduplicate_trauma_concepts(entities: list[dict]) -> list[dict]:
    """
    Remove redundant trauma concepts (e.g., keep only "Motor Vehicle Collision"
    if both "car accident" and "motor vehicle collision" were detected).

    Args:
        entities: List of trauma entities (dict format)

    Returns:
        Deduplicated list
    """
    seen_concepts = set()
    unique = []

    for entity in entities:
        concept = entity.get("concept", "")
        if concept not in seen_concepts:
            seen_concepts.add(concept)
            unique.append(entity)

    return unique
