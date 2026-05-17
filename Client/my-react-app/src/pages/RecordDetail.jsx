import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSingleRecord } from "../services/api";

export default function RecordDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchRecord = async () => {
            try {
                setLoading(true);
                const res = await getSingleRecord(id);
                setRecord(res.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-blue-600">
                Loading record...
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center text-red-500">
                {error}
            </div>
        );
    }

    if (!record) return null;

    return (
        <div className="min-h-screen bg-blue-50 p-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-blue-900">
                    Medical Record Details
                </h1>

                <button
                    onClick={() => navigate("/")}
                    className="text-blue-600 hover:underline"
                >
                    ← Back
                </button>
            </div>

            {/* Patient Info */}
            <div className="bg-white p-6 rounded-xl shadow mb-6 border border-blue-100">
                <h2 className="text-xl font-semibold text-blue-800 mb-2">
                    {record.patient?.PatientName || "Unknown"}
                </h2>

                <p className="text-gray-600">
                    Age: {record.patient?.Age || "-"} | Gender: {record.patient?.Gender || "-"}
                </p>

                <p className="text-sm text-gray-400 mt-2">
                    Created: {new Date(record.createdAt).toLocaleString()}
                </p>
            </div>

            {/* Clinical Text */}
            <div className="bg-white p-6 rounded-xl shadow mb-6 border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">
                    Clinical Notes
                </h3>

                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {record.clinicalText}
                </p>
            </div>

            {/* Codes Section */}
            <div className="grid md:grid-cols-2 gap-6">

                {/* ICD Codes */}
                <div className="bg-white p-6 rounded-xl shadow border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">
                        ICD-10 Codes
                    </h3>

                    {record.result?.icd10?.length ? (
                        <div className="flex flex-wrap gap-2">
                            {record.result.icd10.map((code) => (
                                <span
                                    key={code}
                                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm"
                                >
                                    {code}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">No ICD codes found</p>
                    )}
                </div>

                {/* CPT Codes */}
                <div className="bg-white p-6 rounded-xl shadow border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">
                        CPT Codes
                    </h3>

                    {record.result?.cpt?.length ? (
                        <div className="flex flex-wrap gap-2">
                            {record.result.cpt.map((code) => (
                                <span
                                    key={code}
                                    className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm"
                                >
                                    {code}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">No CPT codes found</p>
                    )}
                </div>
            </div>

            {/* Status */}
            <div className="mt-6">
                <span
                    className={`px-4 py-2 rounded-full text-sm font-medium ${record.status === "processed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                >
                    {record.status}
                </span>
            </div>

        </div>
    );
}