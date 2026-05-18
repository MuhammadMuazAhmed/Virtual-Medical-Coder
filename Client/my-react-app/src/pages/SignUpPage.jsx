import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signUpUser } from "../services/api";

export default function SignUpPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!username.trim() || !email.trim() || !password.trim()) {
            return setError("Please fill in all fields.");
        }

        if (username.trim().length < 3) {
            return setError("Username must be at least 3 characters long.");
        }

        if (password.length < 6) {
            return setError("Password must be at least 6 characters long.");
        }

        try {
            setLoading(true);
            await signUpUser(username.trim(), email.trim(), password);
            setSuccess("Registration successful! Redirecting to sign in...");
            setTimeout(() => navigate("/signin"), 1500);
        } catch (err) {
            setError(err.message || "Failed to register account.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                
                {/* Logo and title */}
                <div className="flex flex-col items-center mb-6">
                    <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mb-3">
                        <i className="ti ti-stethoscope text-white text-lg" />
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900">Create Account</h1>
                    <p className="text-sm text-gray-400 mt-1">Get started with MedCoder billing automation</p>
                </div>

                {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3.5 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="text-xs text-green-700 bg-green-50 border border-green-100 px-3.5 py-3 rounded-lg mb-4 font-medium">
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. sarahmitchell"
                            className="w-full text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="e.g. sarah.mitchell@clinic.com"
                            className="w-full text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 6 characters"
                            className="w-full text-sm px-3.5 py-2.5 border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-700 transition disabled:opacity-40 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Registering...
                            </span>
                        ) : (
                            "Sign Up"
                        )}
                    </button>
                </form>

                <p className="text-xs text-center text-gray-400 mt-6">
                    Already have an account?{" "}
                    <Link to="/signin" className="text-gray-900 font-medium hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
