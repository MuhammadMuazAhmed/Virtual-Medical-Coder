import mongoose, { Schema, Document } from "mongoose";


export interface Record extends Document {
    PatientId: mongoose.Schema.Types.ObjectId;
    text: string;
    FileUrl: string;
    Filetype: string;
    Status: string;
    CreatedAt: Date;
}

const recordSchema: Schema<Record> = new Schema({
    PatientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    text: { type: String, required: true },
    FileUrl: { type: String, required: true },
    Filetype: { type: String, required: true },
    Status: { type: String, required: true },
    CreatedAt: { type: Date, required: true },
});

export default mongoose.models.Record || mongoose.model<Record>("Record", recordSchema);