import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSingleRecord, deleteRecord, approveRecord } from "../services/api";

export default function RecordDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [approving, setApproving] = useState(false);
    const [success, setSuccess] = useState("");

    // Editable codes
    const [icd10Codes, setIcd10Codes] = useState([]);
    const [cptCodes, setCptCodes] = useState([]);
    const [newIcd10, setNewIcd10] = useState("");
    const [newCpt, setNewCpt] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        const fetchRecord = async () => {
            try {
                setLoading(true);
                const res = await getSingleRecord(id);
                setRecord(res.data);
                setIcd10Codes(res.data.result?.icd10 || []);
                setCptCodes(res.data.result?.cpt || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [id]);

    const addIcd10 = () => {
        if (newIcd10.trim() && !icd10Codes.includes(newIcd10.toUpperCase())) {
            setIcd10Codes([...icd10Codes, newIcd10.toUpperCase()]);
            setNewIcd10("");
            setIsEditing(true);
        }
    };

    const removeIcd10 = (code) => {
        setIcd10Codes(icd10Codes.filter((c) => c !== code));
        setIsEditing(true);
    };

    const addCpt = () => {
        if (newCpt.trim() && !cptCodes.includes(newCpt.toUpperCase())) {
            setCptCodes([...cptCodes, newCpt.toUpperCase()]);
            setNewCpt("");
            setIsEditing(true);
        }
    };

    const removeCpt = (code) => {
        setCptCodes(cptCodes.filter((c) => c !== code));
        setIsEditing(true);
    };

    const handleApprove = async () => {
        try {
            setApproving(true);
            setError("");
            setSuccess("");

            await approveRecord(id, {
                icd10: icd10Codes,
                cpt: cptCodes,
                diagnosis: record.result?.diagnosis || [],
                procedure: record.result?.procedure || [],
            });

            setSuccess("Record approved successfully!");
            setIsEditing(false);
            setTimeout(() => navigate("/pending"), 1200);
        } catch (err) {
            setError(err.message || "Failed to approve record");
        } finally {
            setApproving(false);
        }
    };

    const handleDelete = async () => {
        const ok = window.confirm("Delete this record? This action cannot be undone.");
        if (!ok) return;
        try {
            setDeleting(true);
            setError("");
            await deleteRecord(id);
            navigate("/records");
        } catch (err) {
            setError(err.message || "Failed to delete record");
        } finally {
            setDeleting(false);
        }
    };

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

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate("/")}
                        className="text-blue-600 hover:underline"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                        {deleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
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

                    {icd10Codes.length ? (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {icd10Codes.map((code) => (
                                <div key={code} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2 group">
                                    {code}
                                    {record.status !== "processed" && (
                                        <button
                                            onClick={() => removeIcd10(code)}
                                            className="opacity-0 group-hover:opacity-100 transition text-blue-700 hover:text-blue-900 font-bold"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm mb-4">No ICD codes found</p>
                    )}

                    {record.status !== "processed" && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="e.g., E11.9"
                                value={newIcd10}
                                onChange={(e) => setNewIcd10(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && addIcd10()}
                                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition"
                            />
                            <button
                                onClick={addIcd10}
                                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>

                {/* CPT Codes */}
                <div className="bg-white p-6 rounded-xl shadow border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">
                        CPT Codes
                    </h3>

                    {cptCodes.length ? (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {cptCodes.map((code) => (
                                <div key={code} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-2 group">
                                    {code}
                                    {record.status !== "processed" && (
                                        <button
                                            onClick={() => removeCpt(code)}
                                            className="opacity-0 group-hover:opacity-100 transition text-green-700 hover:text-green-900 font-bold"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm mb-4">No CPT codes found</p>
                    )}

                    {record.status !== "processed" && (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="e.g., 99213"
                                value={newCpt}
                                onChange={(e) => setNewCpt(e.target.value)}
                                onKeyPress={(e) => e.key === "Enter" && addCpt()}
                                className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-blue-400 transition"
                            />
                            <button
                                onClick={addCpt}
                                className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Status */}
            <div className="mt-6">
                <span
                    className={`px-4 py-2 rounded-full text-sm font-medium ${record.status === "processed"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                >
                    {record.status === "processed" ? "Processed" : "Pending Review"}
                </span>
            </div>

            {success && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
                    {success}
                </div>
            )}

            {record.status !== "processed" && (
                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        onClick={handleApprove}
                        disabled={approving || deleting}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                        {approving ? "Approving..." : "Approve Record"}
                    </button>
                </div>
            )}

        </div>
    );
}