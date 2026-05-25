import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../[...nextauth]/options";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session) {
            return NextResponse.json(
                { error: "Not signed in" },
                { status: 401 }
            );
        }

        // Clear the NextAuth session by setting the cookie to expire
        const response = NextResponse.json(
            { success: true, message: "Signed out successfully" },
            { status: 200 }
        );

        // NextAuth handles session clearing via its default signout behavior
        // We just need to respond and the client will handle redirect
        response.cookies.set("next-auth.session-token", "", {
            maxAge: 0,
            path: "/",
        });

        return response;
    } catch (error) {
        console.error("Signout error:", error);
        return NextResponse.json(
            { error: "Failed to sign out" },
            { status: 500 }
        );
    }
}
