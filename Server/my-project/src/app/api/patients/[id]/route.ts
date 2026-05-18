import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import connectDB from "@/lib/dbConnect";
import Patient from "@/models/Patient";
import Record from "@/models/Record";
import Result from "@/models/Result";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

// ─────────────────────────────────────────────
// GET SINGLE PATIENT
// ─────────────────────────────────────────────
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
        }

        const patient = await Patient.findById(id);
        if (!patient) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: patient });

    } catch (error) {
        console.error("GET PATIENT ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch patient" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────
// UPDATE PATIENT  ✅ new
// ─────────────────────────────────────────────
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
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
        }

        const body = await req.json();
        const { PatientName, Age, Gender } = body;

        // Only validate fields that are actually being sent
        if (PatientName !== undefined) {
            if (typeof PatientName !== "string" || PatientName.trim().length < 2) {
                return NextResponse.json(
                    { error: "PatientName must be at least 2 characters." },
                    { status: 400 }
                );
            }
        }

        if (Age !== undefined) {
            const ageNum = parseInt(Age);
            if (isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
                return NextResponse.json(
                    { error: "Age must be a valid number between 0 and 130." },
                    { status: 400 }
                );
            }
        }

        if (Gender !== undefined) {
            if (!["Male", "Female", "Other"].includes(Gender)) {
                return NextResponse.json(
                    { error: "Gender must be Male, Female, or Other." },
                    { status: 400 }
                );
            }
        }

        // Build update object with only provided fields
        const updateData: Record<string, any> = {};
        if (PatientName) updateData.PatientName = PatientName.trim();
        if (Age) updateData.Age = parseInt(Age);
        if (Gender) updateData.Gender = Gender;

        const updated = await Patient.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }  // new: true returns updated doc
        );

        if (!updated) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: updated });

    } catch (error) {
        console.error("UPDATE PATIENT ERROR:", error);
        return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
    }
}

// ─────────────────────────────────────────────
// DELETE PATIENT
// ─────────────────────────────────────────────
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const { id } = await params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid patient ID" }, { status: 400 });
        }

        const patient = await Patient.findById(id);
        if (!patient) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        // ✅ Fix 1: Clean up linked records and results before deleting patient
        const patientRecords = await Record.find({ patientId: id }).select("_id");
        const recordIds = patientRecords.map((r) => r._id);

        if (recordIds.length > 0) {
            await Result.deleteMany({ recordId: { $in: recordIds } });
            await Record.deleteMany({ patientId: id });
        }

        await Patient.findByIdAndDelete(id);

        return NextResponse.json({
            success: true,
            message: "Patient and all linked records deleted successfully.",
            deletedRecords: recordIds.length,
        });

    } catch (error) {
        console.error("DELETE PATIENT ERROR:", error);
        return NextResponse.json({ error: "Failed to delete patient" }, { status: 500 });
    }
}