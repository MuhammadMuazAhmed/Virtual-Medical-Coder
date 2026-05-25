import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import fs from "fs/promises";
import path from "path";

const FILE = path.join(process.cwd(), "..", "..", "nlp", "data", "icd_codes.json");

async function ensureAdmin(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
        return false;
    }
    return true;
}

export async function PUT(req: NextRequest, { params }: { params: { code: string } }) {
    if (!(await ensureAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { code } = params;
        const body = await req.json();
        const raw = await fs.readFile(FILE, "utf-8");
        const arr = JSON.parse(raw);
        const idx = arr.findIndex((e) => String(e.icd10) === String(code));
        if (idx === -1) return NextResponse.json({ error: "Code not found" }, { status: 404 });
        arr[idx] = { ...arr[idx], ...body };
        await fs.writeFile(FILE, JSON.stringify(arr, null, 2), "utf-8");
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("ICD10 PUT ERROR:", error);
        return NextResponse.json({ error: "Failed to update ICD-10 entry" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { code: string } }) {
    if (!(await ensureAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { code } = params;
        const raw = await fs.readFile(FILE, "utf-8");
        let arr = JSON.parse(raw);
        const newArr = arr.filter((e) => String(e.icd10) !== String(code));
        if (newArr.length === arr.length) return NextResponse.json({ error: "Code not found" }, { status: 404 });
        await fs.writeFile(FILE, JSON.stringify(newArr, null, 2), "utf-8");
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("ICD10 DELETE ERROR:", error);
        return NextResponse.json({ error: "Failed to delete ICD-10 entry" }, { status: 500 });
    }
}
