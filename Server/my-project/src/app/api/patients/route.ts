import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import connectDB from "@/lib/dbConnect";
import Patient from "@/models/Patient";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";

// ─────────────────────────────────────────────
// GET ALL PATIENTS
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const search = searchParams.get("search") || "";

        // ✅ Fix 5: Search by name
        const query = search
            ? { PatientName: { $regex: search, $options: "i" } }
            : {};

        const [patients, total] = await Promise.all([
            Patient.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit),
            Patient.countDocuments(query),   // ✅ Fix 1: for pagination metadata
        ]);

        return NextResponse.json({
            success: true,
            count: patients.length,
            total,
            page,
            limit,
            data: patients,
        });

    } catch (error) {
        console.error("GET PATIENTS ERROR:", error);
        return NextResponse.json(
            { error: "Failed to fetch patients" },
            { status: 500 }
        );
    }
}

// ─────────────────────────────────────────────
// CREATE PATIENT
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const body = await req.json();
        const { PatientName, Age, Gender } = body;

        // ✅ Fix 2: Proper validation with type checks
        if (!PatientName || typeof PatientName !== "string" || PatientName.trim().length < 2) {
            return NextResponse.json(
                { error: "PatientName must be at least 2 characters." },
                { status: 400 }
            );
        }

        const ageNum = parseInt(Age);
        if (!Age || isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
            return NextResponse.json(
                { error: "Age must be a valid number between 0 and 130." },
                { status: 400 }
            );
        }

        if (!Gender || !["Male", "Female", "Other"].includes(Gender)) {
            return NextResponse.json(
                { error: "Gender must be Male, Female, or Other." },
                { status: 400 }
            );
        }

        // ✅ Fix 3: Duplicate check — same name + age + gender
        const existing = await Patient.findOne({
            PatientName: PatientName.trim(),
            Age: ageNum,
            Gender,
        });

        if (existing) {
            return NextResponse.json(
                {
                    error: "A patient with the same name, age, and gender already exists.",
                    existingId: existing._id,
                },
                { status: 409 }
            );
        }

        // ✅ Fix 4: Track who created this patient
        const patient = await Patient.create({
            PatientName: PatientName.trim(),
            Age: ageNum,
            Gender,
            createdBy: session.user.id,
        });

        return NextResponse.json(
            { success: true, data: patient },
            { status: 201 }   // 201 Created is more correct than 200 for POST
        );

    } catch (error) {
        console.error("CREATE PATIENT ERROR:", error);
        return NextResponse.json(
            { error: "Failed to create patient" },
            { status: 500 }
        );
    }
}