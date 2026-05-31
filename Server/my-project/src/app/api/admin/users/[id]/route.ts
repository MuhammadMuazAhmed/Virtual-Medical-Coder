import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import connectDB from "@/lib/dbConnect";
import mongoose from "mongoose";
import User from "@/models/User";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { id } = params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        const body = await req.json();
        const { isActive, role } = body;

        const update: any = {};
        if (typeof isActive === "boolean") update.isActive = isActive;
        if (role && ["doctor", "admin"].includes(role)) update.role = role;

        const updated = await User.findByIdAndUpdate(id, update, { new: true }).lean();
        if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: {
            id: updated._id,
            name: updated.Name,
            email: updated.email || updated.Email,
            role: updated.role,
            isActive: updated.isActive,
            createdAt: updated.CreatedAt,
        } });
    } catch (error) {
        console.error("ADMIN UPDATE USER ERROR:", error);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const { id } = params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        const deleted = await User.findByIdAndDelete(id);
        if (!deleted) return NextResponse.json({ error: "User not found" }, { status: 404 });

        return NextResponse.json({ success: true, message: "User deleted" });
    } catch (error) {
        console.error("ADMIN DELETE USER ERROR:", error);
        return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
    }
}
