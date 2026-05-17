import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getRecords } from "../services/api";

export default function RecordsPage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");

    const LIMIT = 10;
    const navigate = useNavigate();

    // ✅ Fix: useCallback so useEffect dependency is stable
    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const res = await getRecords({ page, limit: LIMIT });

            setRecords(res.data);
            setTotal(res.count); // ✅ Fix: was res.total — backend returns res.count
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    // ── Derived state ──────────────────────────────────────────────────────────

    const stats = {
        total,
        processed: records.filter((r) => r.status === "processed").length,
        pending: records.filter((r) => r.status === "pending_review").length,
        thisWeek: records.filter((r) => {
            const created = new Date(r.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return created >= weekAgo;
        }).length,
    };

    const filteredRecords = records
        .filter((r) => {
            if (filter === "all") return true;
            if (filter === "processed") return r.status === "processed";
            if (filter === "pending") return r.status === "pending_review";
            return true;
        })
        .filter((r) => {
            if (!search) return true;
            const name = r.patient?.PatientName?.toLowerCase() || "";
            const codes = [...(r.result?.icd10 || []), ...(r.result?.cpt || [])].join(" ").toLowerCase();
            return name.includes(search.toLowerCase()) || codes.includes(search.toLowerCase());
        });

    // ── Helpers ────────────────────────────────────────────────────────────────

    const getInitials = (name = "") =>
        name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

    const avatarColors = [
        "bg-blue-100 text-blue-700",
        "bg-teal-100 text-teal-700",
        "bg-purple-100 text-purple-700",
        "bg-rose-100 text-rose-700",
    ];

    const getAvatarColor = (name = "") => {
        const index = name.charCodeAt(0) % avatarColors.length;
        return avatarColors[index];
    };

    const badgeStyle = (status) => {
        if (status === "processed") return "bg-green-100 text-green-700";
        if (status === "pending_review") return "bg-amber-100 text-amber-700";
        return "bg-blue-100 text-blue-700";
    };

    const badgeLabel = (status) => {
        if (status === "processed") return "Processed";
        if (status === "pending_review") return "Pending Review";
        return status;
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">

            {/* ── Header ── */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-lg font-medium text-gray-900">Medical Records</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{total} total records</p>
                </div>
                <button
                    onClick={() => navigate("/upload")}
                    className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                >
                    + Upload Record
                </button>
            </div>

            {/* ── Stats Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                    { label: "Total Records", value: stats.total, color: "text-gray-900" },
                    { label: "Processed", value: stats.processed, color: "text-green-600" },
                    { label: "Pending Review", value: stats.pending, color: "text-amber-600" },
                    { label: "This Week", value: stats.thisWeek, color: "text-gray-900" },
                ].map((s) => (
                    <div
                        key={s.label}
                        className="bg-white border border-gray-100 rounded-xl p-4"
                    >
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                        <p className={`text-2xl font-medium ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* ── Filters + Search ── */}
            <div className="flex flex-wrap gap-2 items-center mb-5">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by patient name or code..."
                    className="flex-1 min-w-[200px] text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400"
                />
                {["all", "processed", "pending"].map((f) => (
                    <button
                        key={f}
                        onClick={() => { setFilter(f); setPage(1); }}
                        className={`text-xs px-4 py-2 rounded-full border transition ${filter === f
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                            }`}
                    >
                        {f === "all" ? "All" : f === "processed" ? "Processed" : "Pending"}
                    </button>
                ))}
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* ── Loading ── */}
            {loading && (
                <div className="text-center text-sm text-gray-400 py-10">
                    Loading records...
                </div>
            )}

            {/* ── Records Grid ── */}
            {!loading && filteredRecords.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRecords.map((rec) => (
                        <div
                            key={rec._id}
                            onClick={() => navigate(`/record/${rec._id}`)}
                            className="cursor-pointer bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-300 transition group"
                        >
                            {/* Top row */}
                            <div className="flex justify-between items-start mb-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium ${getAvatarColor(rec.patient?.PatientName)}`}>
                                    {getInitials(rec.patient?.PatientName || "?")}
                                </div>
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${badgeStyle(rec.status)}`}>
                                    {badgeLabel(rec.status)}
                                </span>
                            </div>

                            {/* Patient info */}
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {rec.patient?.PatientName || "Unknown Patient"}
                            </p>
                            <p className="text-xs text-gray-400 mb-3">
                                Age {rec.patient?.Age || "—"} · {rec.patient?.Gender || "—"}
                            </p>

                            {/* Clinical text preview */}
                            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                                {rec.clinicalText || "No clinical text available."}
                            </p>

                            {/* ICD / CPT codes */}
                            {(rec.result?.icd10?.length > 0 || rec.result?.cpt?.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {[...(rec.result?.icd10 || []), ...(rec.result?.cpt || [])]
                                        .slice(0, 4)
                                        .map((code) => (
                                            <span
                                                key={code}
                                                className="font-mono text-xs px-2 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500"
                                            >
                                                {code}
                                            </span>
                                        ))}
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                                <span className="text-xs text-gray-400">
                                    {new Date(rec.createdAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </span>
                                <span className="text-gray-300 group-hover:text-gray-500 transition text-sm">→</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Empty State ── */}
            {!loading && filteredRecords.length === 0 && !error && (
                <div className="text-center text-sm text-gray-400 py-16">
                    No records found.
                </div>
            )}

            {/* ── Pagination ── */}
            <div className="flex justify-between items-center mt-8 pt-5 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                    Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}
                </span>
                <div className="flex gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="text-xs px-4 py-2 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:border-gray-400 transition"
                    >
                        ← Prev
                    </button>
                    <span className="text-xs px-4 py-2 bg-gray-900 text-white rounded-lg font-medium">
                        {page}
                    </span>
                    <button
                        disabled={page * LIMIT >= total} // ✅ Fix: was records.length < 10
                        onClick={() => setPage((p) => p + 1)}
                        className="text-xs px-4 py-2 bg-white border border-gray-200 rounded-lg disabled:opacity-40 hover:border-gray-400 transition"
                    >
                        Next →
                    </button>
                </div>
            </div>

        </div>
    );
}