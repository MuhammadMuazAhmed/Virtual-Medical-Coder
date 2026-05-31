"""
import_icd10.py
─────────────────────────────────────────────────────────────────────────────
Imports ICD-10 codes from CMS flat text file into MongoDB Atlas.

Usage:
    python import_icd10.py

Make sure icd10cm_codes_2025.txt is in the same folder as this script.

Install dependencies first:
    pip install pymongo python-dotenv
"""

import os
from pymongo import MongoClient, ASCENDING, TEXT
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

MONGO_URI   = os.getenv("MONGODB_URI")
DB_NAME     = "test"
COLLECTION  = "icd10_codes"
FILE_PATH   = "icd10cm_codes_2025.txt"

# ─────────────────────────────────────────────────────────────────────────────
# CONNECT
# ─────────────────────────────────────────────────────────────────────────────

print("Connecting to MongoDB Atlas...")
client = MongoClient(MONGO_URI)
db     = client[DB_NAME]
col    = db[COLLECTION]

# Drop existing collection to avoid duplicates on re-run
col.drop()
print(f"Dropped existing '{COLLECTION}' collection.")

# ─────────────────────────────────────────────────────────────────────────────
# PARSE FILE
# ─────────────────────────────────────────────────────────────────────────────

# CMS flat file format:
# First 7 characters = code (may have trailing spaces)
# Rest of line       = description
# Example:
# A000     Cholera due to Vibrio cholerae 01, biovar cholerae

documents = []

print(f"Reading {FILE_PATH}...")

with open(FILE_PATH, "r", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if len(line) < 8:
            continue

        code        = line[:7].strip()
        description = line[7:].strip()

        if not code or not description:
            continue

        documents.append({
            "code":        code,
            "description": description,
            "synonyms":    [],          # custom synonyms added via admin UI later
        })

print(f"Parsed {len(documents):,} codes.")

# ─────────────────────────────────────────────────────────────────────────────
# INSERT
# ─────────────────────────────────────────────────────────────────────────────

BATCH_SIZE = 1000
total = len(documents)

for i in range(0, total, BATCH_SIZE):
    batch = documents[i:i + BATCH_SIZE]
    col.insert_many(batch)
    print(f"  Inserted {min(i + BATCH_SIZE, total):,} / {total:,}")

# ─────────────────────────────────────────────────────────────────────────────
# INDEXES
# ─────────────────────────────────────────────────────────────────────────────

print("Creating indexes...")

# Unique index on code for fast exact lookups
col.create_index([("code", ASCENDING)], unique=True, name="code_idx")

# Text index on description + synonyms for full-text search
col.create_index(
    [("description", TEXT), ("synonyms", TEXT)],
    name="text_search_idx",
    default_language="english"
)

print("Indexes created.")
print(f"\nDone. {total:,} ICD-10 codes imported into '{DB_NAME}.{COLLECTION}'.")

client.close()
