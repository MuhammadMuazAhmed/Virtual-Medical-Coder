import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import Record from "@/models/Record";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const patientId = searchParams.get("patientId");
        const status = searchParams.get("status");

        // ✅ Fix: page validation
        const page = Math.max(parseInt(searchParams.get("page") || "1"), 1);

        // ✅ Fix: limit cap
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

        if (patientId && !mongoose.Types.ObjectId.isValid(patientId)) {
            return NextResponse.json({ error: "Invalid patientId format" }, { status: 400 });
        }

        const pipeline: any[] = [];

        // ✅ Status filter + user isolation (non-admin users only see their own records)
        const matchStage: any = {};
        if (session.user.role !== "admin") {
            matchStage.createdBy = new mongoose.Types.ObjectId(session.user.id);
        }
        if (patientId) {
            matchStage.patientId = new mongoose.Types.ObjectId(patientId);
        }
        if (status && ["pending", "approved"].includes(status)) {
            matchStage.status = status;
        }

        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        pipeline.push({
            $lookup: {
                from: "patients",
                localField: "patientId",
                foreignField: "_id",
                as: "patient",
            },
        });

        // ✅ Fix: safe unwind for patient
        pipeline.push({
            $unwind: {
                path: "$patient",
                preserveNullAndEmptyArrays: true,
            },
        });

        pipeline.push({
            $lookup: {
                from: "results",
                localField: "_id",
                foreignField: "recordId",
                as: "result",
            },
        });

        pipeline.push({
            $unwind: {
                path: "$result",
                preserveNullAndEmptyArrays: true,
            },
        });

        pipeline.push({ $sort: { createdAt: -1 } });

        // ✅ Fix: total count (before pagination)
        const totalRecords = await Record.aggregate([
            ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
            { $count: "total" },
        ]);

        const total = totalRecords[0]?.total || 0;

        // pagination
        pipeline.push({ $skip: (page - 1) * limit });
        pipeline.push({ $limit: limit });

        const records = await Record.aggregate(pipeline);

        return NextResponse.json({
            success: true,
            total,              // ✅ added
            count: records.length,
            page,
            limit,
            data: records,
        });

    } catch (error) {
        console.error("GET RECORDS ERROR:", error);
        return NextResponse.json(
            { error: "Failed to fetch records" },
            { status: 500 }
        );
    }
}