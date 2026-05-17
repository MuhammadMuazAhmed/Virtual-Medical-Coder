import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { uploadRecord } from "../services/api";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;

const STEPS = ["Select file", "Patient info", "Processing"];

export default function UploadPage() {
    const [file, setFile] = useState(null);
    const [patientId, setPatientId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [step, setStep] = useState(0); // 0-indexed

    const navigate = useNavigate();

    // ── File handling ──────────────────────────────────────────────────────────

    const handleFile = useCallback((f) => {
        if (!f) return;

        if (!ACCEPTED_TYPES.includes(f.type)) {
            setError("Unsupported file type. Please upload a PDF, JPG, PNG, or WEBP.");
            return;
        }
        if (f.size > MAX_SIZE_MB * 1024 * 1024) {
            setError(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
            return;
        }

        setError("");
        setFile(f);
        setStep(1);
    }, []);

    const removeFile = () => {
        setFile(null);
        setStep(0);
    };

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    }, [handleFile]);

    const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);

    // ── Submit ─────────────────────────────────────────────────────────────────

    const handleUpload = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!file) return setError("Please select a file to upload.");
        if (!patientId.trim()) return setError("Patient ID is required.");

        // ✅ Validate ObjectId format before hitting the server
        if (!/^[a-f\d]{24}$/i.test(patientId.trim())) {
            return setError("Patient ID must be a valid 24-character MongoDB ObjectId.");
        }

        try {
            setLoading(true);
            setStep(2);
            await uploadRecord(file, patientId.trim());
            setSuccess("Record uploaded and processed successfully.");
            setTimeout(() => navigate("/"), 1500);
        } catch (err) {
            setError(err.message);
            setStep(1); // step back on failure
        } finally {
            setLoading(false);
        }
    };

    // ── Helpers ────────────────────────────────────────────────────────────────

    const formatBytes = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / 1048576).toFixed(1)} MB`;
    };

    const getExtLabel = (f) => f.name.split(".").pop().toUpperCase().slice(0, 4);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl p-7">

                {/* Back */}
                <button
                    onClick={() => navigate("/")}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition mb-5"
                >
                    ← Back to records
                </button>

                {/* Header */}
                <h1 className="text-base font-medium text-gray-900 mb-1">
                    Upload medical record
                </h1>
                <p className="text-sm text-gray-400 mb-6">
                    Upload a clinical document to extract ICD &amp; CPT codes automatically.
                </p>

                {/* Steps */}
                <div className="flex mb-7">
                    {STEPS.map((label, i) => (
                        <div key={label} className="flex-1 relative text-center">
                            {/* connector line */}
                            {i < STEPS.length - 1 && (
                                <div className={`absolute top-2.5 left-1/2 right-[-50%] h-px ${i < step ? "bg-green-400" : "bg-gray-100"}`} />
                            )}
                            <div className={`w-5 h-5 rounded-full mx-auto mb-1.5 flex items-center justify-center text-xs relative z-10 border transition
                ${i < step ? "bg-green-500 border-green-500 text-white"
                                    : i === step ? "bg-gray-900 border-gray-900 text-white"
                                        : "bg-white border-gray-200 text-gray-400"}`}
                            >
                                {i < step ? "✓" : i + 1}
                            </div>
                            <div className={`text-xs ${i < step ? "text-green-600"
                                    : i === step ? "text-gray-900 font-medium"
                                        : "text-gray-400"}`}
                            >
                                {label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Alerts */}
                {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg mb-4">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2.5 rounded-lg mb-4">
                        {success}
                    </div>
                )}

                <form onSubmit={handleUpload} className="space-y-5">

                    {/* File drop zone */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Document
                        </label>

                        {!file ? (
                            <div
                                onDrop={onDrop}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onClick={() => document.getElementById("file-input").click()}
                                className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition
                  ${dragOver
                                        ? "border-blue-400 bg-blue-50"
                                        : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                                    }`}
                            >
                                <div className="text-2xl mb-2">📄</div>
                                <p className="text-sm font-medium text-gray-600 mb-1">
                                    Drop file here or click to browse
                                </p>
                                <p className="text-xs text-gray-400">PDF, JPG, PNG, WEBP · max {MAX_SIZE_MB} MB</p>
                                <input
                                    id="file-input"
                                    type="file"
                                    accept=".pdf,image/*"
                                    className="hidden"
                                    // ✅ Fix: was [e.target].files[0] — markdown link bug
                                    onChange={(e) => handleFile(e.target.files[0])}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-xs font-medium text-blue-700 flex-shrink-0">
                                    {getExtLabel(file)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {/* ✅ Fix: was [file.name] — markdown link bug */}
                                    <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                                    <p className="text-xs text-gray-400">{formatBytes(file.size)}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={removeFile}
                                    className="text-gray-300 hover:text-red-400 transition text-lg leading-none"
                                >
                                    ×
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Patient ID */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Patient ID
                        </label>
                        <input
                            type="text"
                            value={patientId}
                            // ✅ Fix: was [e.target].value — markdown link bug
                            onChange={(e) => setPatientId(e.target.value)}
                            placeholder="e.g. 664f3c2a1b2e3d4f5a6b7c8d"
                            className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-gray-400 transition"
                        />
                        <p className="text-xs text-gray-400 mt-1.5">
                            24-character MongoDB ObjectId of the patient
                        </p>
                    </div>

                    <div className="border-t border-gray-100 pt-5">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Processing...
                                </span>
                            ) : (
                                "Upload & Process"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}