import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import fs from "fs/promises";
import path from "path";

const FILE = path.join(process.cwd(), "..", "..", "nlp", "data", "cpt_codes.json");

async function ensureAdmin(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "admin") {
        return false;
    }
    return true;
}

export async function GET(req: NextRequest) {
    if (!(await ensureAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const raw = await fs.readFile(FILE, "utf-8");
        const data = JSON.parse(raw);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("CPT READ ERROR:", error);
        return NextResponse.json({ error: "Failed to read CPT data" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!(await ensureAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const body = await req.json();
        const { name, synonyms = [], cpt } = body;
        if (!cpt) return NextResponse.json({ error: "Code is required" }, { status: 400 });

        const raw = await fs.readFile(FILE, "utf-8");
        const arr = JSON.parse(raw);
        if (arr.find((e) => e.cpt === cpt)) {
            return NextResponse.json({ error: "Code already exists" }, { status: 400 });
        }
        arr.push({ name, synonyms, cpt });
        await fs.writeFile(FILE, JSON.stringify(arr, null, 2), "utf-8");
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("CPT POST ERROR:", error);
        return NextResponse.json({ error: "Failed to add CPT entry" }, { status: 500 });
    }
}
