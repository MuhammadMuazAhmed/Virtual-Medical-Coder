import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSingleRecord, approveRecord } from "../services/api";

export default function ReviewRecord() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [record, setRecord] = useState(null);
    const [icd10Codes, setIcd10Codes] = useState([]);
    const [cptCodes, setCptCodes] = useState([]);
    const [diagnosis, setDiagnosis] = useState([]);
    const [procedure, setProcedure] = useState([]);

    const [newIcd10, setNewIcd10] = useState("");
    const [newCpt, setNewCpt] = useState("");

    const [loading, setLoading] = useState(false);
    const [approving, setApproving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // ── Fetch record on mount ──────────────────────────────────────────────────
    useEffect(() => {
        const fetchRecord = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await getSingleRecord(id);
                const data = res.data;
                setRecord(data);
                setIcd10Codes(data.result?.icd10 || []);
                setCptCodes(data.result?.cpt || []);
                setDiagnosis(data.result?.diagnosis || []);
                setProcedure(data.result?.procedure || []);
            } catch (err) {
                setError(err.message || "Failed to load record");
            } finally {
                setLoading(false);
            }
        };

        fetchRecord();
    }, [id]);

    // ── Code management ─────────────────────────────────────────────────────────
    const addIcd10 = () => {
        if (newIcd10.trim() && !icd10Codes.includes(newIcd10.toUpperCase())) {
            setIcd10Codes([...icd10Codes, newIcd10.toUpperCase()]);
            setNewIcd10("");
        }
    };

    const removeIcd10 = (code) => {
        setIcd10Codes(icd10Codes.filter((c) => c !== code));
    };

    const addCpt = () => {
        if (newCpt.trim() && !cptCodes.includes(newCpt.toUpperCase())) {
            setCptCodes([...cptCodes, newCpt.toUpperCase()]);
            setNewCpt("");
        }
    };

    const removeCpt = (code) => {
        setCptCodes(cptCodes.filter((c) => c !== code));
    };

    // ── Approve and save ───────────────────────────────────────────────────────
    const handleApprove = async () => {
        try {
            setApproving(true);
            setError("");
            setSuccess("");

            await approveRecord(id, {
                icd10: icd10Codes,
                cpt: cptCodes,
                diagnosis,
                procedure,
            });

            setSuccess("Record approved successfully!");
            setTimeout(() => navigate("/pending"), 1500);
        } catch (err) {
            setError(err.message || "Failed to approve record");
        } finally {
            setApproving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-blue-50 flex items-center justify-center">
                <div className="text-blue-600 text-lg">Loading record...</div>
            </div>
        );
    }

    if (error && !record) {
        return (
            <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
                <div className="bg-red-50 border border-red-100 rounded-xl p-6 max-w-md text-center">
                    <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
                    <p className="text-red-600 text-sm mb-4">{error}</p>
                    <button
                        onClick={() => navigate("/pending")}
                        className="text-blue-600 hover:underline text-sm"
                    >
                        Back to pending records
                    </button>
                </div>
            </div>
        );
    }

    if (!record) return null;

    return (
        <div className="min-h-screen bg-blue-50 p-6">

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-blue-900">
                    Review Medical Record
                </h1>

                <button
                    onClick={() => navigate("/pending")}
                    className="text-blue-600 hover:underline text-sm"
                >
                    ← Back to pending
                </button>
            </div>

            {/* Alerts */}
            {error && (
                <div className="text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}
            {success && (
                <div className="text-green-700 bg-green-50 border border-green-100 px-4 py-3 rounded-lg mb-4">
                    {success}
                </div>
            )}

            {/* Patient Info */}
            <div className="bg-white p-6 rounded-xl shadow mb-6 border border-blue-100">
                <h2 className="text-xl font-semibold text-blue-800 mb-2">
                    {record.patient?.PatientName || "Unknown"}
                </h2>

                <p className="text-gray-600 text-sm">
                    Age: {record.patient?.Age || "-"} | Gender: {record.patient?.Gender || "-"}
                </p>

                <p className="text-gray-400 text-xs mt-2">
                    Created: {new Date(record.createdAt).toLocaleString()}
                </p>
            </div>

            {/* Clinical Notes */}
            <div className="bg-white p-6 rounded-xl shadow mb-6 border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">
                    Clinical Notes
                </h3>

                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto">
                    {record.clinicalText}
                </p>
            </div>

            {/* Codes Edit Section */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">

                {/* ICD-10 Codes */}
                <div className="bg-white p-6 rounded-xl shadow border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">
                        ICD-10 Codes
                    </h3>

                    {/* Existing codes */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {icd10Codes.length > 0 ? (
                            icd10Codes.map((code) => (
                                <div
                                    key={code}
                                    className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-2 group"
                                >
                                    {code}
                                    <button
                                        onClick={() => removeIcd10(code)}
                                        className="opacity-0 group-hover:opacity-100 transition text-blue-700 hover:text-blue-900 font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400 text-sm">No ICD codes</p>
                        )}
                    </div>

                    {/* Add new code */}
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
                </div>

                {/* CPT Codes */}
                <div className="bg-white p-6 rounded-xl shadow border border-blue-100">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">
                        CPT Codes
                    </h3>

                    {/* Existing codes */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {cptCodes.length > 0 ? (
                            cptCodes.map((code) => (
                                <div
                                    key={code}
                                    className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm flex items-center gap-2 group"
                                >
                                    {code}
                                    <button
                                        onClick={() => removeCpt(code)}
                                        className="opacity-0 group-hover:opacity-100 transition text-green-700 hover:text-green-900 font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-400 text-sm">No CPT codes</p>
                        )}
                    </div>

                    {/* Add new code */}
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
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
                <button
                    onClick={() => navigate("/pending")}
                    disabled={approving}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                    Cancel
                </button>
                <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                >
                    {approving ? "Approving..." : "Approve"}
                </button>
            </div>

        </div>
    );
}
