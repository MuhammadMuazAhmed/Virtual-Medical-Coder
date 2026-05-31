import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import User from "@/models/User";

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const users = await User.find().sort({ CreatedAt: -1 }).lean();

        const output = users.map((u) => ({
            id: u._id,
            name: u.Name,
            email: u.email || u.Email,
            role: u.role || "doctor",
            isActive: u.isActive !== false,
            createdAt: u.CreatedAt,
        }));

        return NextResponse.json({ success: true, data: output });
    } catch (error) {
        console.error("ADMIN USERS ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}
