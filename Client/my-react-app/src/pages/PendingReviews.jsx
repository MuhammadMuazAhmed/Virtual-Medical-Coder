import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getRecords } from "../services/api";

export default function PendingReviews() {
    const navigate = useNavigate();

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchPendingRecords = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await getRecords({ status: "pending" });
                setRecords(res.data || []);
            } catch (err) {
                setError(err.message || "Failed to load pending records");
            } finally {
                setLoading(false);
            }
        };

        fetchPendingRecords();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-blue-50 flex items-center justify-center">
                <div className="text-blue-600 text-lg">Loading pending records...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50 p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-blue-900">
                    Pending Reviews
                </h1>

                <button
                    onClick={() => navigate("/")}
                    className="text-blue-600 hover:underline text-sm"
                >
                    ← Back to records
                </button>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Empty State */}
            {records.length === 0 ? (
                <div className="bg-white border border-blue-100 rounded-xl shadow p-8 text-center">
                    <div className="text-4xl mb-3">✓</div>
                    <h2 className="text-lg font-semibold text-blue-900 mb-1">
                        No pending reviews
                    </h2>
                    <p className="text-gray-500 text-sm mb-4">
                        All medical records have been reviewed and approved.
                    </p>
                    <button
                        onClick={() => navigate("/")}
                        className="text-blue-600 hover:underline text-sm"
                    >
                        View all records
                    </button>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white border border-blue-100 rounded-xl shadow">
                    <table className="w-full">
                        <thead className="bg-blue-50 border-b border-blue-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider">
                                    Patient
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider">
                                    Date Created
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                                    ICD Codes
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                                    CPT Codes
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-blue-800 uppercase tracking-wider">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-100">
                            {records.map((record) => (
                                <tr key={record._id} className="hover:bg-blue-50 transition">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        {record.patient?.PatientName || "Unknown"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {new Date(record.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                                            {record.result?.icd10?.length || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                                            {record.result?.cpt?.length || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => navigate(`/review/${record._id}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                        >
                                            Review
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
