import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInUser } from "../services/api";

export default function SignInPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!email.trim() || !password.trim()) {
            return setError("Please fill in all fields.");
        }

        try {
            setLoading(true);
            await signInUser(email.trim(), password);
            navigate("/dashboard");
        } catch (err) {
            setError(err.message || "Invalid email or password.");
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
                    <h1 className="text-xl font-semibold text-gray-900">Welcome Back</h1>
                    <p className="text-sm text-gray-400 mt-1">Sign in to your MedCoder account</p>
                </div>

                {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3.5 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Password
                            </label>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
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
                                Signing in...
                            </span>
                        ) : (
                            "Sign In"
                        )}
                    </button>
                </form>

                <p className="text-xs text-center text-gray-400 mt-6">
                    Don't have an account?{" "}
                    <Link to="/signup" className="text-gray-900 font-medium hover:underline">
                        Sign up for free
                    </Link>
                </p>
            </div>
        </div>
    );
}
