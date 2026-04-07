import mongoose from "mongoose";

type ConnectionObj = {
    isConnected?: number;
}

const connection: ConnectionObj = {};



export async function dbConnect(): Promise<void> {
    if (connection.isConnected) {
        console.log("Already connected to MongoDB");
        return;
    }


    try {
        const dbConnect = await mongoose.connect(process.env.MONGODB_URI as string);
        connection.isConnected = dbConnect.connections[0].readyState;
        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed", error);
        process.exit(1);
    }
}

export default dbConnect;
