import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import Result from "@/models/Result";
import Record from "@/models/Record";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        // Top ICD-10 codes across processed records
        const icdPipeline = [
            {
                $lookup: {
                    from: "records",
                    localField: "recordId",
                    foreignField: "_id",
                    as: "record",
                },
            },
            { $unwind: "$record" },
            { $match: { "record.status": "processed" } },
            { $unwind: "$icd10" },
            { $group: { _id: "$icd10", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { code: "$_id", count: 1, _id: 0 } },
        ];

        const cptPipeline = [
            {
                $lookup: {
                    from: "records",
                    localField: "recordId",
                    foreignField: "_id",
                    as: "record",
                },
            },
            { $unwind: "$record" },
            { $match: { "record.status": "processed" } },
            { $unwind: "$cpt" },
            { $group: { _id: "$cpt", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { code: "$_id", count: 1, _id: 0 } },
        ];

        const topIcd = await Result.aggregate(icdPipeline);
        const topCpt = await Result.aggregate(cptPipeline);

        return NextResponse.json({ success: true, topIcd10: topIcd, topCpt: topCpt });
    } catch (error) {
        console.error("ADMIN CODE STATS ERROR:", error);
        return NextResponse.json({ error: "Failed to compute code stats" }, { status: 500 });
    }
}
