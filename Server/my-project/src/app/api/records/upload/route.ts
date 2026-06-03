import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import Record from "@/models/Record";
import Result from "@/models/Result";
import Patient from "@/models/Patient";
import cloudinary from "@/lib/Cloudinary";

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

        const nlpBaseUrl = (process.env.NLP_SERVICE_URL || "").trim().replace(/['"]/g, "");
        const response = await fetch(`${nlpBaseUrl}/process-file`, {
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
        console.log("Raw response from NLP service:", JSON.stringify(data, null, 2));

        // ✅ Validate and fix response data structure
        // Handle cases where data might be stringified
        let icd10Data = data.icd10 || [];
        let cptData = data.cpt || [];
        const diagnosis = data.diagnosis || [];
        const procedure = data.procedure || [];

        // If icd10Data is a string, parse it
        if (typeof icd10Data === 'string') {
            console.warn("WARNING: icd10Data is a string, attempting to parse...", icd10Data);
            try {
                icd10Data = JSON.parse(icd10Data);
            } catch (e) {
                console.error("Failed to parse icd10Data:", e);
                icd10Data = [];
            }
        }

        // If cptData is a string, parse it
        if (typeof cptData === 'string') {
            console.warn("WARNING: cptData is a string, attempting to parse...", cptData);
            try {
                cptData = JSON.parse(cptData);
            } catch (e) {
                console.error("Failed to parse cptData:", e);
                cptData = [];
            }
        }

        console.log("Parsed icd10Data:", icd10Data);
        console.log("Parsed cptData:", cptData);

        // ✅ Validate data types before storing
        const icd10Array = Array.isArray(icd10Data) ? icd10Data : [];
        const cptArray = Array.isArray(cptData) ? cptData : [];

        console.log("Final icd10Array type:", typeof icd10Array, "is Array:", Array.isArray(icd10Array));
        console.log("Final cptArray type:", typeof cptArray, "is Array:", Array.isArray(cptArray));

        // Upload file to Cloudinary
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                {
                    resource_type: "auto",
                    folder: "medical_records",
                },
                (error, result) => {
                    if (error) {
                        console.error("Cloudinary upload error:", error);
                        reject(error);
                    } else if (result) {
                        resolve(result as { secure_url: string });
                    } else {
                        reject(new Error("Cloudinary upload failed with no result"));
                    }
                }
            ).end(buffer);
        });

        // ✅ Fix 4: Save with "pending" status for doctor review, track who uploaded it
        const record = await Record.create({
            patientId,
            createdBy: session.user.id,
            clinicalText: data.text,
            fileName: uploadResult.secure_url,   // Store Cloudinary secure URL here
            fileType: file.type,
            status: "pending",
        });

        const result = await Result.create({
            recordId: record._id,
            icd10: icd10Array,
            cpt: cptArray,
            diagnosis: diagnosis.length > 0 ? diagnosis : undefined,
            procedure: procedure.length > 0 ? procedure : undefined,
        });

        return NextResponse.json({
            success: true,
            record,
            result: {
                ...result.toObject(),
                icd10: icd10Array,  // Return exact data that was stored
                cpt: cptArray,      // Return exact data that was stored
            },
        });

    } catch (error) {
        console.error(error);
        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        );
    }
}