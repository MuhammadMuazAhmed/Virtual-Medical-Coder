import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import Record from "@/models/Record";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }  // ✅ Fix 2
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { id: recordId } = await params;  // ✅ Fix 2

        // ✅ Fix 1: was [params.id](http://params.id)
        if (!mongoose.Types.ObjectId.isValid(recordId)) {
            return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
        }

        const record = await Record.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(recordId) },
            },
            {
                $lookup: {
                    from: "patients",
                    localField: "patientId",
                    foreignField: "_id",
                    as: "patient",
                },
            },
            {
                $unwind: {
                    path: "$patient",
                    preserveNullAndEmptyArrays: true,
                },
            },
            {
                $lookup: {
                    from: "results",
                    localField: "_id",
                    foreignField: "recordId",
                    as: "result",
                },
            },
            {
                $unwind: {
                    path: "$result",
                    preserveNullAndEmptyArrays: true,
                },
            },
        ]);

        if (!record || record.length === 0) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: record[0],
        });

    } catch (error) {
        console.error("GET SINGLE RECORD ERROR:", error);
        return NextResponse.json(
            { error: "Failed to fetch record" },
            { status: 500 }
        );
    }
}