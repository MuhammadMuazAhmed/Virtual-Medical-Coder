import mongoose, { Schema, Document } from "mongoose";


export interface User extends Document {
    Name: string;
    Email: string;
    Password: string;
    CreatedAt: Date;
}

const userSchema: Schema<User> = new Schema({
    Name: { type: String, required: true },
    Email: { type: String, required: true, unique: true },
    Password: { type: String, required: true },
    CreatedAt: { type: Date, required: true },
});


export default mongoose.models.User || mongoose.model<User>("User", userSchema);