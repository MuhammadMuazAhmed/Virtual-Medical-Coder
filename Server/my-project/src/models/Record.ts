import mongoose, { Schema, Document } from "mongoose";

export interface Record extends Document {
    patientId: mongoose.Schema.Types.ObjectId;
    clinicalText: string;
    fileName: string;
    fileType: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

const recordSchema: Schema<Record> = new Schema(
    {
        patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
        clinicalText: { type: String, required: true },
        fileName: { type: String, required: true },
        fileType: { type: String, required: true },
        status: { type: String, required: true },
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

export default mongoose.models.Record || mongoose.model<Record>("Record", recordSchema);