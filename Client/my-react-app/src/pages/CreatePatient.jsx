import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "../services/api";

export default function CreatePatient() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        PatientName: "",
        Age: "",
        Gender: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (e) => {
        setError("");
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        const { PatientName, Age, Gender } = formData;

        // ✅ Tightened validation matching backend rules
        if (!PatientName.trim() || PatientName.trim().length < 2) {
            return setError("Patient name must be at least 2 characters.");
        }

        const ageNum = parseInt(Age);
        if (!Age || isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
            return setError("Age must be a valid number between 0 and 130.");
        }

        if (!Gender) {
            return setError("Please select a gender.");
        }

        try {
            setLoading(true);
            await createPatient({
                PatientName: PatientName.trim(),
                Age: ageNum,
                Gender,
            });

            setSuccess("Patient created successfully.");
            setFormData({ PatientName: "", Age: "", Gender: "" });
            setTimeout(() => navigate("/upload"), 1500);

        } catch (err) {
            // ✅ Handle duplicate patient error from backend (409)
            setError(err.message || "Failed to create patient.");
        } finally {
            setLoading(false);
        }
    };

    const isValid = formData.PatientName.trim().length >= 2 &&
        formData.Age !== "" &&
        formData.Gender !== "";

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl p-7">

                {/* Back */}
                <button
                    onClick={() => navigate("/upload")}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition mb-5"
                >
                    ← Back to upload
                </button>

                {/* Header */}
                <h1 className="text-base font-medium text-gray-900 mb-1">
                    Create patient
                </h1>
                <p className="text-sm text-gray-400 mb-6">
                    Add a new patient to the system before uploading their record.
                </p>

                {/* Alerts */}
                {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg mb-4">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2.5 rounded-lg mb-4">
                        {success} Redirecting...
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Patient Name
                        </label>
                        <input
                            type="text"
                            name="PatientName"
                            value={formData.PatientName}
                            onChange={handleChange}
                            placeholder="e.g. Sarah Mitchell"
                            className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-gray-400 transition"
                        />
                    </div>

                    {/* Age + Gender side by side */}
                    <div className="flex gap-3">
                        <div className="w-28">
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                Age
                            </label>
                            <input
                                type="number"
                                name="Age"
                                value={formData.Age}
                                onChange={handleChange}
                                placeholder="0–130"
                                min={0}
                                max={130}
                                className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-300 outline-none focus:border-gray-400 transition"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                Gender
                            </label>
                            <select
                                name="Gender"
                                value={formData.Gender}
                                onChange={handleChange}
                                className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 outline-none focus:border-gray-400 transition"
                            >
                                <option value="">Select</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Preview badge — shows when form is filled */}
                    {isValid && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                                {formData.PatientName.trim()[0].toUpperCase()}
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-800">{formData.PatientName.trim()}</p>
                                <p className="text-xs text-gray-400">{formData.Age}y · {formData.Gender}</p>
                            </div>
                        </div>
                    )}

                    <div className="border-t border-gray-100 pt-4">
                        <button
                            type="submit"
                            disabled={loading || !isValid}
                            className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                "Create Patient"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}