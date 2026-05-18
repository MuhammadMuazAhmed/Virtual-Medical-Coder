import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPatients } from "../services/api";

export default function PatientsPage() {
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await getPatients();
                setPatients(res.data || res); // Handle both {data: [...]} and raw array response
            } catch (err) {
                setError(err.message || "Failed to fetch patients.");
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, []);

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

    const filteredPatients = patients.filter((patient) => {
        if (!search) return true;
        return (
            patient.PatientName?.toLowerCase().includes(search.toLowerCase()) ||
            patient._id?.toLowerCase().includes(search.toLowerCase())
        );
    });

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-lg font-medium text-gray-900">Patients</h1>
                    <p className="text-sm text-gray-400 mt-0.5">{filteredPatients.length} registered patients</p>
                </div>
                <button
                    onClick={() => navigate("/patients/create")}
                    className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-755 transition"
                >
                    + Add Patient
                </button>
            </div>

            {/* Search */}
            <div className="mb-5">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search patients by name or ID..."
                    className="w-full max-w-md text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition"
                />
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {loading && (
                <div className="text-center text-sm text-gray-400 py-12">
                    Loading patients...
                </div>
            )}

            {/* Patients list */}
            {!loading && filteredPatients.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPatients.map((patient) => (
                        <div
                            key={patient._id}
                            className="bg-white border border-gray-100 rounded-xl p-5 hover:border-gray-300 transition group flex items-start gap-3.5"
                        >
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${getAvatarColor(patient.PatientName)}`}>
                                {getInitials(patient.PatientName || "?")}
                            </div>
                            
                            {/* Details */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">
                                    {patient.PatientName || "Unknown Patient"}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Age {patient.Age || "—"} · {patient.Gender || "—"}
                                </p>
                                <div className="mt-2.5 flex items-center gap-1.5">
                                    <span className="text-[10px] font-mono bg-gray-50 border border-gray-150 px-2 py-0.5 rounded text-gray-400 truncate block">
                                        ID: {patient._id}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {!loading && filteredPatients.length === 0 && !error && (
                <div className="text-center text-sm text-gray-400 py-16 bg-white border border-gray-100 rounded-xl">
                    No patients found.
                </div>
            )}
        </div>
    );
}
