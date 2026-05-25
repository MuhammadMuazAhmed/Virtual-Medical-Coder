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

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 🔐 Auth check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { id: recordId } = await params;

        // ✅ Validate ID
        if (!mongoose.Types.ObjectId.isValid(recordId)) {
            return NextResponse.json(
                { error: "Invalid record ID" },
                { status: 400 }
            );
        }

        // 🗑️ Delete record
        const deletedRecord = await Record.findByIdAndDelete(recordId);

        if (!deletedRecord) {
            return NextResponse.json(
                { error: "Record not found" },
                { status: 404 }
            );
        }

        // 🔥 ALSO delete associated result
        await mongoose.model("Result").deleteMany({
            recordId: deletedRecord._id,
        });

        return NextResponse.json({
            success: true,
            message: "Record deleted successfully",
        });

    } catch (error) {
        console.error("DELETE RECORD ERROR:", error);
        return NextResponse.json(
            { error: "Failed to delete record" },
            { status: 500 }
        );
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { id: recordId } = await params;

        if (!mongoose.Types.ObjectId.isValid(recordId)) {
            return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
        }

        const body = await req.json();
        const { icd10, cpt, diagnosis, procedure } = body;

        // Validate input
        if (!Array.isArray(icd10) || !Array.isArray(cpt) || !Array.isArray(diagnosis) || !Array.isArray(procedure)) {
            return NextResponse.json(
                { error: "icd10, cpt, diagnosis, and procedure must be arrays" },
                { status: 400 }
            );
        }

        // Update record with approval info
        const updatedRecord = await Record.findByIdAndUpdate(
            recordId,
            {
                status: "processed",
                approvedAt: new Date(),
                approvedBy: session.user.name || session.user.email,
            },
            { new: true }
        );

        if (!updatedRecord) {
            return NextResponse.json({ error: "Record not found" }, { status: 404 });
        }

        // Load original result to detect edits
        const ResultModel = mongoose.model("Result");
        const originalResult = await ResultModel.findOne({ recordId: new mongoose.Types.ObjectId(recordId) });

        const arraysEqual = (a = [], b = []) => {
            if (a.length !== b.length) return false;
            const sa = [...a].map(String).sort();
            const sb = [...b].map(String).sort();
            for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
            return true;
        };

        const edited = !(
            arraysEqual(originalResult?.icd10 || [], icd10) &&
            arraysEqual(originalResult?.cpt || [], cpt) &&
            arraysEqual(originalResult?.diagnosis || [], diagnosis) &&
            arraysEqual(originalResult?.procedure || [], procedure)
        );

        // Update associated result with edited codes
        const updatedResult = await ResultModel.findOneAndUpdate(
            { recordId: new mongoose.Types.ObjectId(recordId) },
            {
                icd10,
                cpt,
                diagnosis,
                procedure,
            },
            { new: true }
        );

        // Mark record wasEdited if AI codes were modified
        if (edited) {
            await Record.findByIdAndUpdate(recordId, { wasEdited: true });
        }

        // Fetch the full record with relationships
        const record = await Record.aggregate([
            { $match: { _id: new mongoose.Types.ObjectId(recordId) } },
            {
                $lookup: {
                    from: "patients",
                    localField: "patientId",
                    foreignField: "_id",
                    as: "patient",
                },
            },
            { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "results",
                    localField: "_id",
                    foreignField: "recordId",
                    as: "result",
                },
            },
            { $unwind: { path: "$result", preserveNullAndEmptyArrays: true } },
        ]);

        return NextResponse.json({
            success: true,
            data: record[0],
        });

    } catch (error) {
        console.error("PUT RECORD ERROR:", error);
        return NextResponse.json(
            { error: "Failed to update record" },
            { status: 500 }
        );
    }
}