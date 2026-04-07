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
                        email: credentials?.email,
                    });

                    if (!user) {
                        throw new Error("User not found");
                    }

                    // 🔐 Compare hashed password
                    const isPasswordValid = await bcrypt.compare(
                        String(credentials?.password),
                        user.password
                    );

                    if (!isPasswordValid) {
                        throw new Error("Invalid password");
                    }

                    // ✅ Return session user
                    return {
                        id: user._id.toString(),
                        email: user.email,
                        name: user.name,
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
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.name = token.name as string;
            }
            return session;
        }
    },
};