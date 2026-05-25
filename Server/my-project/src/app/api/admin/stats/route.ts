import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import mongoose from "mongoose";
import User from "@/models/User";
import Record from "@/models/Record";
import Patient from "@/models/Patient";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const totalDoctors = await User.countDocuments({ role: "doctor" });
        const totalRecords = await Record.countDocuments({});
        const pendingRecords = await Record.countDocuments({ status: "pending" });
        const approvedRecords = await Record.countDocuments({ status: "processed" });
        const totalPatients = await Patient.countDocuments({});
        const editedBeforeApproval = await Record.countDocuments({ wasEdited: true });

        return NextResponse.json({
            success: true,
            totalDoctors,
            totalRecords,
            pendingRecords,
            approvedRecords,
            totalPatients,
            editedBeforeApproval,
        });
    } catch (error) {
        console.error("ADMIN STATS ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch admin stats" }, { status: 500 });
    }
}
