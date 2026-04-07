import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import Record from "@/models/Record";
import Result from "@/models/Result";
import Patient from "@/models/Patient";

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // ✅ Fix 1: Connect to DB before any model usage
        await connectDB();

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const patientId = formData.get("patientId") as string;

        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        if (!patientId) {
            return NextResponse.json({ error: "Patient ID is required" }, { status: 400 });
        }

        // ✅ Fix 2: Validate patient exists
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return NextResponse.json({ error: "Patient not found" }, { status: 404 });
        }

        // Send to Python
        const pythonFormData = new FormData();
        pythonFormData.append("file", file);

        const response = await fetch(process.env.NLP_SERVICE_URL + "/process-file", {
            method: "POST",
            body: pythonFormData,
        });

        // ✅ Fix 3: Handle Python service errors
        if (!response.ok) {
            const errText = await response.text();
            console.error("NLP service error:", errText);
            return NextResponse.json(
                { error: "NLP service failed to process the file" },
                { status: 502 }
            );
        }

        const data = await response.json();

        // ✅ Fix 4: Honest field name
        const record = await Record.create({
            patientId,
            clinicalText: data.text,
            fileName: file.name,   // renamed from fileUrl
            fileType: file.type,
            status: "processed",
        });

        const result = await Result.create({
            recordId: record._id,
            icd10: data.icd10,
            cpt: data.cpt,
            diagnosis: data.diagnosis,
            procedure: data.procedure,
        });

        return NextResponse.json({
            success: true,
            record,
            result,
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        );
    }
}