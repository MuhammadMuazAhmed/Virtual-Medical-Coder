import mongoose, { Schema, Document } from "mongoose";


export interface User extends Document {
    Name: string;
    Email: string;
    Password: string;
    CreatedAt: Date;
    role?: "doctor" | "admin";
    isActive?: boolean;
}

const userSchema: Schema<User> = new Schema({
    Name: { type: String, required: true },
    Email: { type: String, required: true, unique: true },
    Password: { type: String, required: true },
    CreatedAt: { type: Date, required: true },
    role: { type: String, enum: ["doctor", "admin"], default: "doctor" },
    isActive: { type: Boolean, default: true },
});


export default mongoose.models.User || mongoose.model<User>("User", userSchema);