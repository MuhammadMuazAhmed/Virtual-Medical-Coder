import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/dbConnect";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: {
                    label: "Email",
                    type: "email",
                },
                password: {
                    label: "Password",
                    type: "password",
                },
            },

            async authorize(credentials) {
                await connectDB();

                try {
                    // 🔍 Find user by email
                    const user = await User.findOne({
                        $or: [{ Email: credentials?.email }, { email: credentials?.email }],
                    });

                    if (!user) {
                        throw new Error("User not found");
                    }

                    if (user.isActive === false) {
                        throw new Error("Account is deactivated");
                    }

                    // 🔐 Compare hashed password
                    const isPasswordValid = await bcrypt.compare(
                        String(credentials?.password),
                        user.Password
                    );

                    if (!isPasswordValid) {
                        throw new Error("Invalid password");
                    }

                    // ✅ Return session user with role so client can authorize admin UI
                    return {
                        id: user._id.toString(),
                        email: user.email || user.Email,
                        name: user.Name,
                        role: user.role || "doctor",
                    };

                } catch (error) {
                    console.log("Auth error:", error);
                    throw new Error("Authentication failed");
                }
            },
        }),
    ],

    session: {
        strategy: "jwt",
    },

    secret: process.env.NEXTAUTH_SECRET,

    pages: {
        signIn: "/signin",   // match your route
        error: "/error",
    },

    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.name = user.name;
                token.role = user.role;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name as string;
                session.user.role = token.role as string;
            }
            return session;
        }
    },
};