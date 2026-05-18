import mongoose, { Schema, Document } from "mongoose";

export interface Patient extends Document {
    PatientName: string;
    Age: number;
    Gender: string;
    createdBy?: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const patientSchema: Schema<Patient> = new Schema(
    {
        PatientName: { type: String, required: true },
        Age: { type: Number, required: true },
        Gender: { type: String, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    {
        timestamps: true, // Automatically manages createdAt and updatedAt
    }
);

export default mongoose.models.Patient || mongoose.model<Patient>("Patient", patientSchema);