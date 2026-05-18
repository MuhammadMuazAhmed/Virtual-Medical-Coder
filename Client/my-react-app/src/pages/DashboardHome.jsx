import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRecords } from "../services/api";
import { getPatients } from "../services/api";

export default function DashboardHome() {
    const [records, setRecords] = useState([]);
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            try {
                const [recRes, patRes] = await Promise.all([
                    getRecords({ page: 1, limit: 5 }),
                    getPatients(),
                ]);
                setRecords(recRes.data || []);
                setPatients(patRes.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const stats = {
        total: records.length,
        processed: records.filter((r) => r.status === "processed").length,
        pending: records.filter((r) => r.status === "pending_review").length,
        patients: patients.length,
    };

    const getInitials = (name = "") =>
        name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

    const avatarColors = [
        "bg-blue-50 text-blue-700",
        "bg-teal-50 text-teal-700",
        "bg-purple-50 text-purple-700",
        "bg-rose-50 text-rose-700",
    ];
    const getColor = (name = "") => avatarColors[name.charCodeAt(0) % avatarColors.length];

    const badgeStyle = (status) =>
        status === "processed"
            ? "bg-green-100 text-green-700"
            : "bg-amber-100 text-amber-700";

    return (
        <div className="p-6">

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
                {[
                    { label: "Total Records", value: stats.total, icon: "ti-file-text", color: "text-gray-900" },
                    { label: "Processed", value: stats.processed, icon: "ti-circle-check", color: "text-green-600" },
                    { label: "Pending Review", value: stats.pending, icon: "ti-clock", color: "text-amber-600" },
                    { label: "Patients", value: stats.patients, icon: "ti-users", color: "text-gray-900" },
                ].map((s) => (
                    <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 uppercase tracking-wide mb-2">
                            <i className={`ti ${s.icon} text-sm`} aria-hidden="true" />
                            {s.label}
                        </div>
                        <p className={`text-2xl font-medium ${s.color}`}>
                            {loading ? "—" : s.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Recent Records — takes 2/3 width */}
                <div className="lg:col-span-2">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-sm font-medium text-gray-900">Recent records</h2>
                        <button
                            onClick={() => navigate("/records")}
                            className="text-xs text-gray-400 hover:text-gray-700 transition"
                        >
                            View all →
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
                    ) : records.length === 0 ? (
                        <div className="text-sm text-gray-400 py-8 text-center bg-white border border-gray-100 rounded-xl">
                            No records yet.{" "}
                            <button onClick={() => navigate("/upload")} className="underline text-gray-600">
                                Upload one
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {records.map((rec) => (
                                <div
                                    key={rec._id}
                                    onClick={() => navigate(`/records/${rec._id}`)}
                                    className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-gray-300 transition"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${getColor(rec.patient?.PatientName)}`}>
                                        {getInitials(rec.patient?.PatientName || "?")}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {rec.patient?.PatientName || "Unknown"}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {rec.patient?.Age}y · {rec.patient?.Gender}
                                        </p>
                                    </div>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {[...(rec.result?.icd10 || []), ...(rec.result?.cpt || [])]
                                            .slice(0, 2)
                                            .map((code) => (
                                                <span key={code} className="font-mono text-xs px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500">
                                                    {code}
                                                </span>
                                            ))}
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${badgeStyle(rec.status)}`}>
                                        {rec.status === "processed" ? "Processed" : "Pending"}
                                    </span>
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                        {new Date(rec.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right column */}
                <div className="flex flex-col gap-5">

                    {/* Recent Patients */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-sm font-medium text-gray-900">Recent patients</h2>
                            <button
                                onClick={() => navigate("/patients")}
                                className="text-xs text-gray-400 hover:text-gray-700 transition"
                            >
                                View all →
                            </button>
                        </div>
                        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
                            {loading ? (
                                <div className="text-xs text-gray-400 py-6 text-center">Loading...</div>
                            ) : patients.length === 0 ? (
                                <div className="text-xs text-gray-400 py-6 text-center">No patients yet.</div>
                            ) : (
                                patients.slice(0, 5).map((p) => (
                                    <div
                                        key={p._id}
                                        onClick={() => navigate(`/patients/${p._id}`)}
                                        className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition first:rounded-t-xl last:rounded-b-xl"
                                    >
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${getColor(p.PatientName)}`}>
                                            {getInitials(p.PatientName)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-800 truncate">{p.PatientName}</p>
                                        </div>
                                        <p className="text-xs text-gray-400">{p.Age}y · {p.Gender[0]}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Voice — coming soon */}
                    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center">
                        <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                            <i className="ti ti-microphone-off text-gray-400 text-lg" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">Voice records</p>
                        <p className="text-xs text-gray-400">Coming soon — dictate clinical notes directly</p>
                        <span className="text-xs px-3 py-1 bg-gray-100 text-gray-500 rounded-full mt-1">
                            In development
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}