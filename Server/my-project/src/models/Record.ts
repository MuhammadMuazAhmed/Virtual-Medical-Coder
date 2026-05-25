import mongoose, { Schema, Document } from "mongoose";

export interface Record extends Document {
    patientId: mongoose.Schema.Types.ObjectId;
    clinicalText: string;
    fileName: string;
    fileType: string;
    status: "pending" | "processed";
    approvedAt?: Date;
    approvedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

const recordSchema: Schema<Record> = new Schema(
    {
        patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
        clinicalText: { type: String, required: true },
        fileName: { type: String, required: true },
        fileType: { type: String, required: true },
        status: { type: String, enum: ["pending", "processed"], default: "pending", required: true },
        approvedAt: { type: Date, default: null },
        approvedBy: { type: String, default: null },
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

export default mongoose.models.Record || mongoose.model<Record>("Record", recordSchema);