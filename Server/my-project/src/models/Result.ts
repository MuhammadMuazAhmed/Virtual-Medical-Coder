import mongoose, { Schema, Document } from "mongoose";


export interface Result extends Document {
    RecordId: string;
    ICD10: string[];
    CPT: string[];
    Diagnosis: string[];
    Procedure: string[];
    CreatedAt: Date;
}

const resultSchema: Schema<Result> = new Schema({
    RecordId: { type: String, required: true },
    ICD10: { type: [String], required: true },
    CPT: { type: [String], required: true },
    Diagnosis: { type: [String], required: true },
    Procedure: { type: [String], required: true },
    CreatedAt: { type: Date, required: true },
});

export default mongoose.models.Result || mongoose.model<Result>("Result", resultSchema);