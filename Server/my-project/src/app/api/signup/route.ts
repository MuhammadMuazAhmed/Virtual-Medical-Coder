import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/dbConnect";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { username, email, password } = await req.json();

        if (!username || !email || !password) {
            return NextResponse.json(
                { error: "Username, email, and password are required" },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await User.findOne({ Email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { error: "User with this email already exists" },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await User.create({
            Name: username,
            Email: email.toLowerCase(),
            Password: hashedPassword,
            CreatedAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            message: "User registered successfully",
            user: {
                id: newUser._id,
                name: newUser.Name,
                email: newUser.Email,
            },
        });

    } catch (error) {
        console.error("Signup error:", error);
        return NextResponse.json(
            { error: "Something went wrong during registration" },
            { status: 500 }
        );
    }
}
