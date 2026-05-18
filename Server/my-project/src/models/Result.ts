import mongoose, { Schema, Document } from "mongoose";

export interface Result extends Document {
    recordId: mongoose.Schema.Types.ObjectId;
    icd10: string[];
    cpt: string[];
    diagnosis: string[];
    procedure: string[];
    createdAt: Date;
    updatedAt: Date;
}

const resultSchema: Schema<Result> = new Schema(
    {
        recordId: { type: mongoose.Schema.Types.ObjectId, ref: "Record", required: true },
        icd10: { type: [String], required: true },
        cpt: { type: [String], required: true },
        diagnosis: { type: [String], required: true },
        procedure: { type: [String], required: true },
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

export default mongoose.models.Result || mongoose.model<Result>("Result", resultSchema);