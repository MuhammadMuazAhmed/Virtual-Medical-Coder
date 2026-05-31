import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminStats, getAdminCodeStats } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [codes, setCodes] = useState({ topIcd10: [], topCpt: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [sRes, cRes] = await Promise.all([getAdminStats(), getAdminCodeStats()]);
                setStats(sRes);
                setCodes(cRes);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading || !stats) return (
        <div className="min-h-screen bg-blue-50 p-6">Loading admin dashboard...</div>
    );

    const { totalDoctors, totalRecords, pendingRecords, approvedRecords, totalPatients } = stats;
    const aiAccuracy = approvedRecords ? Math.round(((approvedRecords - stats.editedBeforeApproval) / approvedRecords) * 100) : 0;

    return (
        <div className="min-h-screen bg-blue-50 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-blue-900">Admin Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-600">Manage doctors, roles, and account activity from here.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link to="/admin/users" className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
                        User Management
                    </Link>
                    <Link to="/admin/codes" className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 transition">
                        Code Management
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: "Total Doctors", value: totalDoctors },
                    { label: "Total Records", value: totalRecords },
                    { label: "Pending Approvals", value: pendingRecords },
                    { label: "Approved Records", value: approvedRecords },
                ].map((s) => (
                    <div key={s.label} className="bg-white border border-blue-100 rounded-xl p-4 shadow">
                        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                        <p className="text-2xl font-medium text-blue-800">{s.value}</p>
                    </div>
                ))}
                <div className="bg-white border border-blue-100 rounded-xl p-4 shadow">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Patients</p>
                    <p className="text-2xl font-medium text-blue-800">{totalPatients}</p>
                </div>
                <div className="bg-white border border-blue-100 rounded-xl p-4 shadow">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">AI Accuracy Rate</p>
                    <p className="text-2xl font-medium text-blue-800">{aiAccuracy}%</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-blue-100 rounded-xl p-4 shadow">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Top ICD-10 Codes</h3>
                    <div style={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={codes.topIcd10} layout="vertical">
                                <XAxis type="number" />
                                <YAxis dataKey="code" type="category" width={120} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#3b82f6" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white border border-blue-100 rounded-xl p-4 shadow">
                    <h3 className="text-lg font-semibold text-blue-800 mb-3">Top CPT Codes</h3>
                    <div style={{ width: "100%", height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={codes.topCpt} layout="vertical">
                                <XAxis type="number" />
                                <YAxis dataKey="code" type="category" width={120} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
