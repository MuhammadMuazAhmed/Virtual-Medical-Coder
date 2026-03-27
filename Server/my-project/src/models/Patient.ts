import mongoose, { Schema, Document } from "mongoose";


export interface Patient extends Document {
    PatientId: mongoose.Schema.Types.ObjectId;
    PatientName: string;
    Age: number;
    Gender: string;
    CreatedAt: Date;

}

const patientSchema: Schema<Patient> = new Schema({
    PatientId: { type: mongoose.Schema.Types.ObjectId, ref: "Record", required: true },
    PatientName: { type: String, required: true },
    Age: { type: Number, required: true },
    Gender: { type: String, required: true },
    CreatedAt: { type: Date, required: true },
});

export default mongoose.models.Patient || mongoose.model<Patient>("Patient", patientSchema);