"""
abbreviation_expander.py
─────────────────────────────────────────────────────────────────────────────
Expands clinical abbreviations to full terms before NER runs.
This improves NER accuracy significantly because scispaCy recognizes
"shortness of breath" much better than "SOB".

Usage:
    from processors.abbreviation_expander import expand_abbreviations
    expanded = expand_abbreviations("Pt c/o SOB and HTN. ECG ordered.")
"""

from __future__ import annotations
import re

# ─────────────────────────────────────────────────────────────────────────────
# ABBREVIATION DICTIONARY
# Format: "ABBREVIATION": "full term"
# Keys are uppercase — matching is case-insensitive
# ─────────────────────────────────────────────────────────────────────────────

ABBREVIATIONS: dict[str, str] = {

    # ── Diseases & Conditions ─────────────────────────────────────────────────
    "DM":       "diabetes mellitus",
    "DM2":      "type 2 diabetes mellitus",
    "T2DM":     "type 2 diabetes mellitus",
    "T1DM":     "type 1 diabetes mellitus",
    "HTN":      "hypertension",
    "HBP":      "high blood pressure",
    "CAD":      "coronary artery disease",
    "CHF":      "congestive heart failure",
    "HF":       "heart failure",
    "AF":       "atrial fibrillation",
    "AFIB":     "atrial fibrillation",
    "MI":       "myocardial infarction",
    "ACS":      "acute coronary syndrome",
    "STEMI":    "ST elevation myocardial infarction",
    "NSTEMI":   "non ST elevation myocardial infarction",
    "CVA":      "cerebrovascular accident",
    "TIA":      "transient ischemic attack",
    "COPD":     "chronic obstructive pulmonary disease",
    "CKD":      "chronic kidney disease",
    "ESRD":     "end stage renal disease",
    "UTI":      "urinary tract infection",
    "URTI":     "upper respiratory tract infection",
    "LRTI":     "lower respiratory tract infection",
    "PNA":      "pneumonia",
    "TB":       "tuberculosis",
    "HIV":      "human immunodeficiency virus",
    "RA":       "rheumatoid arthritis",
    "OA":       "osteoarthritis",
    "IBD":      "inflammatory bowel disease",
    "IBS":      "irritable bowel syndrome",
    "GERD":     "gastroesophageal reflux disease",
    "PUD":      "peptic ulcer disease",
    "MDD":      "major depressive disorder",
    "GAD":      "generalized anxiety disorder",
    "PTSD":     "post traumatic stress disorder",
    "ADHD":     "attention deficit hyperactivity disorder",
    "MS":       "multiple sclerosis",
    "PD":       "parkinson disease",
    "AD":       "alzheimer disease",
    "SLE":      "systemic lupus erythematosus",
    "DVT":      "deep vein thrombosis",
    "PE":       "pulmonary embolism",
    "OSA":      "obstructive sleep apnea",
    "NASH":     "non alcoholic steatohepatitis",
    "HCC":      "hepatocellular carcinoma",
    "CRC":      "colorectal cancer",
    "BPH":      "benign prostatic hyperplasia",
    "PCOS":     "polycystic ovary syndrome",
    "GDM":      "gestational diabetes mellitus",
    "PID":      "pelvic inflammatory disease",
    "STI":      "sexually transmitted infection",
    "STD":      "sexually transmitted disease",

    # ── Symptoms ──────────────────────────────────────────────────────────────
    "SOB":      "shortness of breath",
    "DOE":      "dyspnea on exertion",
    "CP":       "chest pain",
    "HA":       "headache",
    "N/V":      "nausea and vomiting",
    "N/V/D":    "nausea vomiting and diarrhea",
    "ABD":      "abdominal",
    "LBP":      "low back pain",
    "LOC":      "loss of consciousness",
    "AMS":      "altered mental status",
    "WOB":      "work of breathing",

    # ── Investigations ────────────────────────────────────────────────────────
    "CBC":      "complete blood count",
    "CMP":      "comprehensive metabolic panel",
    "BMP":      "basic metabolic panel",
    "LFT":      "liver function test",
    "KFT":      "kidney function test",
    "RFT":      "renal function test",
    "TFT":      "thyroid function test",
    "TSH":      "thyroid stimulating hormone",
    "FBS":      "fasting blood sugar",
    "RBS":      "random blood sugar",
    "HBA1C":    "hemoglobin a1c",
    "A1C":      "hemoglobin a1c",
    "ECG":      "electrocardiogram",
    "EKG":      "electrocardiogram",
    "ECHO":     "echocardiogram",
    "CXR":      "chest x-ray",
    "AXR":      "abdominal x-ray",
    "CT":       "computed tomography",
    "MRI":      "magnetic resonance imaging",
    "US":       "ultrasound",
    "PFT":      "pulmonary function test",
    "ABG":      "arterial blood gas",
    "INR":      "international normalized ratio",
    "PT":       "prothrombin time",
    "PTT":      "partial thromboplastin time",
    "ESR":      "erythrocyte sedimentation rate",
    "CRP":      "c-reactive protein",
    "PSA":      "prostate specific antigen",
    "HBsAG":    "hepatitis b surface antigen",
    "ANTI-HCV": "hepatitis c antibody",
    "PPD":      "tuberculin skin test",
    "EEG":      "electroencephalogram",
    "EMG":      "electromyogram",

    # ── Medications ───────────────────────────────────────────────────────────
    "ASA":      "aspirin",
    "APAP":     "acetaminophen",
    "MTX":      "methotrexate",
    "PPI":      "proton pump inhibitor",
    "ACE":      "ace inhibitor",
    "ARB":      "angiotensin receptor blocker",
    "BB":       "beta blocker",
    "CCB":      "calcium channel blocker",
    "SSRI":     "selective serotonin reuptake inhibitor",
    "SNRI":     "serotonin norepinephrine reuptake inhibitor",
    "TCA":      "tricyclic antidepressant",
    "NSAID":    "non steroidal anti inflammatory drug",
    "OCP":      "oral contraceptive pill",
    "IV":       "intravenous",
    "IM":       "intramuscular",
    "SC":       "subcutaneous",
    "SL":       "sublingual",
    "PO":       "oral",
    "PRN":      "as needed",
    "BID":      "twice daily",
    "TID":      "three times daily",
    "QID":      "four times daily",
    "QD":       "once daily",
    "OD":       "once daily",

    # ── Clinical context ──────────────────────────────────────────────────────
    "HX":       "history",
    "PMH":      "past medical history",
    "FHX":      "family history",
    "SHX":      "social history",
    "CC":       "chief complaint",
    "HPI":      "history of present illness",
    "ROS":      "review of systems",
    "PE":       "physical examination",
    "VS":       "vital signs",
    "BP":       "blood pressure",
    "HR":       "heart rate",
    "RR":       "respiratory rate",
    "SPO2":     "oxygen saturation",
    "BMI":      "body mass index",
    "WT":       "weight",
    "HT":       "height",
    "WNL":      "within normal limits",
    "NAD":      "no acute distress",
    "A&O":      "alert and oriented",
    "C/O":      "complains of",
    "H/O":      "history of",
    "K/C/O":    "known case of",
    "W/O":      "without",
    "S/P":      "status post",
    "R/O":      "rule out",
    "D/C":      "discharge",
    "F/U":      "follow up",
    "PT":       "patient",
    "YO":       "year old",
    "YOM":      "year old male",
    "YOF":      "year old female",
    "M":        "male",
    "F":        "female",
    "Hx":       "history",
    "Dx":       "diagnosis",
    "Tx":       "treatment",
    "Sx":       "symptoms",
    "Rx":       "prescription",
    "Fx":       "fracture",
    "Bx":       "biopsy",
}


# ─────────────────────────────────────────────────────────────────────────────
# EXPANDER
# ─────────────────────────────────────────────────────────────────────────────

def expand_abbreviations(text: str) -> str:
    """
    Replace clinical abbreviations with their full terms.

    Matching is:
    - Case-insensitive
    - Word-boundary aware (won't replace 'MI' inside 'ADMISSION')
    - Preserves original text structure
    """
    for abbr, full in ABBREVIATIONS.items():
        # Word boundary match, case insensitive
        pattern = r'\b' + re.escape(abbr) + r'\b'
        text = re.sub(pattern, full, text, flags=re.IGNORECASE)
    return text