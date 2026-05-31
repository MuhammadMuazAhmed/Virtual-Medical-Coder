import { useEffect, useState } from "react";
import { getAdminUsers, updateAdminUser, deleteAdminUser } from "../services/api";

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");

    const load = async () => {
        try {
            setLoading(true);
            const res = await getAdminUsers();
            setUsers(res.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const toggleActive = async (u) => {
        if (!confirm(`Set ${u.name} active=${!u.isActive}?`)) return;
        await updateAdminUser(u.id, { isActive: !u.isActive });
        load();
    };

    const changeRole = async (u) => {
        const next = u.role === "admin" ? "doctor" : "admin";
        if (!confirm(`Change role of ${u.name} to ${next}?`)) return;
        await updateAdminUser(u.id, { role: next });
        load();
    };

    const remove = async (u) => {
        if (!confirm(`Delete user ${u.name}? This cannot be undone.`)) return;
        await deleteAdminUser(u.id);
        load();
    };

    const filtered = users.filter((u) => {
        const matchesQuery =
            !query ||
            (u.name || "").toLowerCase().includes(query.toLowerCase()) ||
            (u.email || "").toLowerCase().includes(query.toLowerCase());
        const matchesRole =
            roleFilter === "all" ||
            (u.role || "doctor") === roleFilter;
        return matchesQuery && matchesRole;
    });

    return (
        <div className="min-h-screen bg-blue-50 p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-blue-900">User Management</h1>
            </div>

            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or email"
                    className="w-full md:w-1/3 text-sm px-3 py-2 border border-gray-200 rounded-lg"
                />
                <div className="flex items-center gap-3">
                    <label className="text-sm text-blue-800">Show:</label>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="text-sm px-3 py-2 border border-gray-200 rounded-lg"
                    >
                        <option value="all">All users</option>
                        <option value="doctor">Doctors only</option>
                        <option value="admin">Admins only</option>
                    </select>
                </div>
            </div>

            <div className="bg-white border border-blue-100 rounded-xl shadow overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-blue-50 border-b border-blue-100">
                        <tr>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Name</th>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Email</th>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Role</th>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Status</th>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Joined</th>
                            <th className="text-right px-4 py-2 text-xs text-blue-800">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((u) => (
                            <tr key={u.id} className="border-b border-blue-50 hover:bg-blue-50">
                                <td className="px-4 py-3 text-sm font-medium">{u.name}</td>
                                <td className="px-4 py-3 text-sm">{u.email || u.Email}</td>
                                <td className="px-4 py-3 text-sm">{u.role}</td>
                                <td className="px-4 py-3 text-sm">{u.isActive ? "Active" : "Inactive"}</td>
                                <td className="px-4 py-3 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-sm text-right">
                                    <button onClick={()=>toggleActive(u)} className="text-sm text-blue-600 mr-3">
                                        {u.isActive ? "Deactivate" : "Activate"}
                                    </button>
                                    <button onClick={()=>changeRole(u)} className="text-sm text-blue-600 mr-3">
                                        Change role
                                    </button>
                                    <button onClick={()=>remove(u)} className="text-sm text-red-600">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
