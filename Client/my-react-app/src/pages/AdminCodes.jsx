import { useEffect, useState } from "react";
import { getAdminIcd10, postAdminIcd10, putAdminIcd10, deleteAdminIcd10, getAdminCpt, postAdminCpt, putAdminCpt, deleteAdminCpt } from "../services/api";

function Modal({ open, onClose, onSave, initial }) {
    const [code, setCode] = useState(initial?.code || "");
    const [name, setName] = useState(initial?.name || "");
    const [synonyms, setSynonyms] = useState((initial?.synonyms || []).join(", "));

    useEffect(()=>{
        setCode(initial?.code || ""); setName(initial?.name || ""); setSynonyms((initial?.synonyms || []).join(", "));
    },[initial]);

    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl w-full max-w-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-3">{initial ? "Edit" : "Add"} Code</h3>
                <div className="mb-3">
                    <label className="text-xs text-gray-500">Code</label>
                    <input value={code} onChange={(e)=>setCode(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg" />
                </div>
                <div className="mb-3">
                    <label className="text-xs text-gray-500">Name</label>
                    <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg" />
                </div>
                <div className="mb-4">
                    <label className="text-xs text-gray-500">Synonyms (comma separated)</label>
                    <input value={synonyms} onChange={(e)=>setSynonyms(e.target.value)} className="w-full text-sm px-3 py-2 border rounded-lg" />
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
                    <button onClick={()=>onSave({ code, name, synonyms: synonyms.split(",").map(s=>s.trim()).filter(Boolean) })} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>
                </div>
            </div>
        </div>
    );
}

export default function AdminCodes(){
    const [tab, setTab] = useState("icd");
    const [icd, setIcd] = useState([]);
    const [cpt, setCpt] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [query, setQuery] = useState("");

    const load = async () => {
        try{
            setLoading(true);
            const [iRes, cRes] = await Promise.all([getAdminIcd10(), getAdminCpt()]);
            setIcd(iRes.data || []);
            setCpt(cRes.data || []);
        }catch(err){console.error(err);}finally{setLoading(false);}    
    };

    useEffect(()=>{load();},[]);

    const openAdd = ()=>{ setEditing(null); setModalOpen(true); };
    const openEdit = (item)=>{ setEditing(item); setModalOpen(true); };

    const saveIcd = async (payload) => {
        if (editing) await putAdminIcd10(editing.icd10, { name: payload.name, synonyms: payload.synonyms, icd10: payload.code });
        else await postAdminIcd10({ name: payload.name, synonyms: payload.synonyms, icd10: payload.code });
        setModalOpen(false); load();
    };

    const saveCpt = async (payload) => {
        if (editing) await putAdminCpt(editing.cpt, { name: payload.name, synonyms: payload.synonyms, cpt: payload.code });
        else await postAdminCpt({ name: payload.name, synonyms: payload.synonyms, cpt: payload.code });
        setModalOpen(false); load();
    };

    const removeIcd = async (code)=>{ if(!confirm(`Delete ${code}?`)) return; await deleteAdminIcd10(code); load(); };
    const removeCpt = async (code)=>{ if(!confirm(`Delete ${code}?`)) return; await deleteAdminCpt(code); load(); };

    const list = tab === "icd" ? icd : cpt;
    const filtered = list.filter((it)=>{
        if(!query) return true;
        const q = query.toLowerCase();
        return (it.name||"").toLowerCase().includes(q) || (it.icd10||it.cpt||"").toString().toLowerCase().includes(q) || (it.synonyms||[]).join(" ").toLowerCase().includes(q);
    });

    return (
        <div className="min-h-screen bg-blue-50 p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-blue-900">Code Database</h1>
                <div className="flex gap-2">
                    <button onClick={()=>setTab("icd")} className={`px-3 py-2 rounded-lg ${tab==="icd"?"bg-blue-600 text-white":"bg-white"}`}>ICD-10</button>
                    <button onClick={()=>setTab("cpt")} className={`px-3 py-2 rounded-lg ${tab==="cpt"?"bg-blue-600 text-white":"bg-white"}`}>CPT</button>
                </div>
            </div>

            <div className="mb-4 flex justify-between items-center">
                <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search codes or names" className="w-full md:w-1/3 text-sm px-3 py-2 border border-gray-200 rounded-lg" />
                <div>
                    <button onClick={openAdd} className="ml-3 px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button>
                </div>
            </div>

            <div className="bg-white border border-blue-100 rounded-xl shadow overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-blue-50 border-b border-blue-100">
                        <tr>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Code</th>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Name</th>
                            <th className="text-left px-4 py-2 text-xs text-blue-800">Synonyms</th>
                            <th className="text-right px-4 py-2 text-xs text-blue-800">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((it)=> (
                            <tr key={(it.icd10||it.cpt)} className="border-b hover:bg-blue-50">
                                <td className="px-4 py-3 text-sm">{it.icd10||it.cpt}</td>
                                <td className="px-4 py-3 text-sm">{it.name}</td>
                                <td className="px-4 py-3 text-sm">{(it.synonyms||[]).join(", ")}</td>
                                <td className="px-4 py-3 text-sm text-right">
                                    <button onClick={()=>openEdit(it)} className="text-blue-600 mr-3">Edit</button>
                                    <button onClick={()=> (tab==="icd"? removeIcd(it.icd10) : removeCpt(it.cpt)) } className="text-red-600">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal open={modalOpen} onClose={()=>setModalOpen(false)} onSave={ tab==="icd" ? saveIcd : saveCpt } initial={editing ? (tab==="icd" ? { code: editing.icd10, name: editing.name, synonyms: editing.synonyms } : { code: editing.cpt, name: editing.name, synonyms: editing.synonyms }) : null } />
        </div>
    );
}
