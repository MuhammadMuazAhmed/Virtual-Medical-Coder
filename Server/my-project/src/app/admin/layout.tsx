import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/options";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions as any);
    if (!session?.user || session.user.role !== "admin") {
        // Redirect non-admins to home
        redirect("/");
    }

    return (
        <div className="min-h-screen bg-blue-50">
            <main>{children}</main>
        </div>
    );
}
