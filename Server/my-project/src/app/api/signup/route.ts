import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/dbConnect";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
    try {
        await connectDB();

        const { username, email, password, adminCode } = await req.json();

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

        const isFirstUser = (await User.countDocuments()) === 0;
        const adminSignupKey = process.env.ADMIN_SIGNUP_CODE;
        let role = "doctor";

        if (adminCode) {
            if (!adminSignupKey) {
                return NextResponse.json(
                    { error: "Admin signup is not enabled on this server" },
                    { status: 400 }
                );
            }
            if (adminCode !== adminSignupKey) {
                return NextResponse.json(
                    { error: "Invalid admin signup code" },
                    { status: 400 }
                );
            }
            role = "admin";
        } else if (isFirstUser) {
            role = "admin";
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const newUser = await User.create({
            Name: username,
            Email: email.toLowerCase(),
            Password: hashedPassword,
            CreatedAt: new Date(),
            role,
        });

        return NextResponse.json({
            success: true,
            message: "User registered successfully",
            user: {
                id: newUser._id,
                name: newUser.Name,
                email: newUser.Email,
                role: newUser.role,
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
