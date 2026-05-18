import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { getMe } from "../services/api";


const navMain = [
    { label: "Dashboard", icon: "ti-layout-dashboard", to: "/dashboard" },
    { label: "Records", icon: "ti-file-text", to: "/records" },
    { label: "Patients", icon: "ti-users", to: "/patients" },
    { label: "Upload Record", icon: "ti-upload", to: "/upload" },
];

const navTools = [
    { label: "NLP Analyzer", icon: "ti-brain", to: "/nlp" },
    { label: "Voice Record", icon: "ti-microphone", to: null, soon: true },
    { label: "Reports", icon: "ti-report-analytics", to: null, soon: true },
];

const navAccount = [
    { label: "Settings", icon: "ti-settings", to: "/settings" },
];

function NavItem({ item }) {
    if (item.soon) {
        return (
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-300 cursor-default opacity-60">
                <i className={`ti ${item.icon} text-base`} aria-hidden="true" />
                {item.label}
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">
                    Soon
                </span>
            </div>
        );
    }

    return (
        <NavLink
            to={item.to}
            className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition cursor-pointer
                ${isActive
                    ? "bg-gray-100 text-gray-900 font-medium"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`
            }
        >
            <i className={`ti ${item.icon} text-base`} aria-hidden="true" />
            {item.label}
        </NavLink>
    );
}

function NavSection({ label, items }) {
    return (
        <div className="mb-1">
            <p className="text-xs text-gray-400 uppercase tracking-widest px-2.5 py-1 mt-3 mb-0.5">
                {label}
            </p>
            <div className="flex flex-col gap-0.5">
                {items.map((item) => <NavItem key={item.label} item={item} />)}
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }) {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        getMe()
            .then((res) => setUser(res.user))
            .catch(() => navigate("/signin")); // not logged in → redirect
    }, []);

    const initials = user?.name
        ?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

    const handleSignOut = async () => {
        await fetch(`${import.meta.env.VITE_API_URL}/api/auth/signout`, {
            method: "POST",
            credentials: "include",
        });
        navigate("/signin");
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">

            {/* ── Sidebar ── */}
            <aside className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">

                {/* Logo */}
                <div className="px-4 py-5 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                            <i className="ti ti-stethoscope text-white text-sm" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900 leading-none">MedCoder</p>
                            <p className="text-xs text-gray-400 mt-0.5">AI Billing System</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-2 py-3 overflow-y-auto">
                    <NavSection label="Main" items={navMain} />
                    <NavSection label="Tools" items={navTools} />
                    <NavSection label="Account" items={navAccount} />
                </nav>

                {/* User footer */}
                <div className="px-2 py-3 border-t border-gray-100">
                    <div
                        className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                        onClick={handleSignOut}
                        title="Sign out"
                    >
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-xs font-medium text-blue-700 flex-shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">
                                {user?.name || "User"}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                                {user?.email || ""}
                            </p>
                        </div>
                        <i className="ti ti-logout text-gray-300 text-sm" aria-hidden="true" />
                    </div>
                </div>
            </aside>

            {/* ── Main area ── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Topbar */}
                <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
                    <div>
                        {/* Page title injected by each page via document.title or a context */}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 transition"
                            title="Search"
                        >
                            <i className="ti ti-search text-sm" aria-hidden="true" />
                        </button>
                        <button
                            className="w-8 h-8 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 transition"
                            title="Notifications"
                        >
                            <i className="ti ti-bell text-sm" aria-hidden="true" />
                        </button>
                        <button
                            onClick={() => navigate("/upload")}
                            className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-700 transition"
                        >
                            <i className="ti ti-plus text-sm" aria-hidden="true" />
                            Upload
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}