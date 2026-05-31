"""
import_cpt.py
─────────────────────────────────────────────────────────────────────────────
Imports HCPCS/CPT codes from CMS Excel file into MongoDB Atlas.

Usage:
    python import_cpt.py

Make sure HCPC2026_JUL_ANWEB.xlsx is in the same folder as this script.

Install dependencies first:
    pip install pymongo python-dotenv openpyxl
"""

import os
from pymongo import MongoClient, ASCENDING, TEXT
from dotenv import load_dotenv
import openpyxl

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

MONGO_URI   = os.getenv("MONGODB_URI")
DB_NAME     = "test"
COLLECTION  = "cpt_codes"
FILE_PATH   = "HCPC2026_JUL_ANWEB.xlsx"

# ─────────────────────────────────────────────────────────────────────────────
# CONNECT
# ─────────────────────────────────────────────────────────────────────────────

print("Connecting to MongoDB Atlas...")
client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
col    = db[COLLECTION]

col.drop()
print(f"Dropped existing '{COLLECTION}' collection.")

# ─────────────────────────────────────────────────────────────────────────────
# PARSE EXCEL FILE
# ─────────────────────────────────────────────────────────────────────────────

# HCPCS Excel file columns (CMS standard layout):
# Column A = HCPC code
# Column B = Modifier
# Column C = Short description
# Column D = Long description (use this)
# Column E+ = other fields we don't need

print(f"Reading {FILE_PATH}...")

wb   = openpyxl.load_workbook(FILE_PATH, read_only=True, data_only=True)
ws   = wb.active

documents = []
skipped   = 0

for i, row in enumerate(ws.iter_rows(values_only=True)):

    # Skip header row
    if i == 0:
        continue

    code             = row[0]
    short_desc       = row[2]
    long_desc        = row[3]

    if not code:
        skipped += 1
        continue

    code      = str(code).strip()
    desc      = str(long_desc).strip() if long_desc else str(short_desc).strip() if short_desc else ""

    if not code or not desc or desc == "None":
        skipped += 1
        continue

    documents.append({
        "code":        code,
        "description": desc,
        "synonyms":    [],
    })

wb.close()
print(f"Parsed {len(documents):,} codes. Skipped {skipped} empty rows.")

# ─────────────────────────────────────────────────────────────────────────────
# INSERT
# ─────────────────────────────────────────────────────────────────────────────

BATCH_SIZE = 500
total = len(documents)

for i in range(0, total, BATCH_SIZE):
    batch = documents[i:i + BATCH_SIZE]
    col.insert_many(batch, ordered=False)
    print(f"  Inserted {min(i + BATCH_SIZE, total):,} / {total:,}")

# ─────────────────────────────────────────────────────────────────────────────
# INDEXES
# ─────────────────────────────────────────────────────────────────────────────

print("Creating indexes...")

col.create_index([("code", ASCENDING)], unique=True, name="code_idx")

col.create_index(
    [("description", TEXT), ("synonyms", TEXT)],
    name="text_search_idx",
    default_language="english"
)

print("Indexes created.")
print(f"\nDone. {total:,} CPT/HCPCS codes imported into '{DB_NAME}.{COLLECTION}'.")

client.close()
