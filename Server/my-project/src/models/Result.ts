import mongoose, { Schema, Document } from "mongoose";

export interface ICD10Entry {
    code: string;
    evidence: string;         // Original text that caused the match
    matchType: string;        // entity_match, fallback_rule, trauma_match, semantic_match, default
    confidence?: number;      // 0-1 confidence score
}

export interface CPTEntry {
    code: string;
    evidence: string;         // Keyword or procedure text
    matchType: string;        // keyword_scan, semantic_match, default
    confidence?: number;      // 0-1 confidence score
}

// Legacy format support (backward compatibility)
export interface Result extends Document {
    recordId: mongoose.Schema.Types.ObjectId;
    icd10: (string | ICD10Entry)[];           // Can be string (legacy) or ICD10Entry (new)
    cpt: (string | CPTEntry)[];               // Can be string (legacy) or CPTEntry (new)
    diagnosis?: string[];                      // Legacy: descriptions for icd10
    procedure?: string[];                      // Legacy: descriptions for cpt
    createdAt: Date;
    updatedAt: Date;
}

const icd10EntrySchema = new Schema(
    {
        code: { type: String, required: true },
        evidence: { type: String, required: true },
        matchType: { type: String, required: true },
        confidence: { type: Number, min: 0, max: 1, default: 1.0 },
    },
    { _id: false }
);

const cptEntrySchema = new Schema(
    {
        code: { type: String, required: true },
        evidence: { type: String, required: true },
        matchType: { type: String, required: true },
        confidence: { type: Number, min: 0, max: 1, default: 1.0 },
    },
    { _id: false }
);

const resultSchema: Schema<Result> = new Schema(
    {
        recordId: { type: mongoose.Schema.Types.ObjectId, ref: "Record", required: true },
        icd10: {
            type: [mongoose.Schema.Types.Mixed],  // Supports both string and objects
            required: true,
        },
        cpt: {
            type: [mongoose.Schema.Types.Mixed],  // Supports both string and objects
            required: true,
        },
        diagnosis: { type: [String] },     // Optional, for legacy format
        procedure: { type: [String] },     // Optional, for legacy format
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

export default mongoose.models.Result || mongoose.model<Result>("Result", resultSchema);