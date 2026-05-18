import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ message: "Use NextAuth endpoints at /api/auth for authentication" });
}
