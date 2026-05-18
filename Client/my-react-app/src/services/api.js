// ✅ Fix 2: Catch missing env var at module load time and strip trailing slash to prevent double-slash redirects
let API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
    throw new Error("VITE_API_URL is not defined in your .env file");
}
API_URL = API_URL.replace(/\/$/, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const handleResponse = async (res) => {
    let data;
    try {
        data = await res.json();
    } catch {
        throw new Error("Invalid server response — expected JSON");
    }
    if (!res.ok) {
        throw new Error(data?.error || `Request failed with status ${res.status}`);
    }
    return data;
};

// ✅ Fix 1: Central place to build headers with auth token if needed
const getHeaders = () => {
    const headers = {};
    // If you switch to token-based auth later, add it here:
    // headers["Authorization"] = `Bearer ${getToken()}`;
    return headers;
};

// ✅ Fix 4: Reusable fetch with timeout
const fetchWithTimeout = (url, options = {}, timeoutMs = 30000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timer));
};

// ─── Records API ──────────────────────────────────────────────────────────────

export const uploadRecord = async (file, patientId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId);

    // ✅ Fix 4: 60s timeout for uploads (OCR/NLP can be slow)
    const res = await fetchWithTimeout(
        `${API_URL}/api/records/upload`,
        {
            method: "POST",
            headers: getHeaders(),   // NOTE: do NOT set Content-Type manually — browser sets multipart boundary
            body: formData,
            credentials: "include",
        },
        60000
    );

    return handleResponse(res);  // ✅ Fix 5: removed redundant try/catch + console.error
};

export const getRecords = async ({ patientId = "", page = 1, limit = 10 } = {}) => {
    // ✅ Fix 3: URLSearchParams handles encoding cleanly
    const params = new URLSearchParams({ page, limit });
    if (patientId) params.set("patientId", patientId);

    const res = await fetchWithTimeout(
        `${API_URL}/api/records?${params.toString()}`,
        {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
        }
    );

    return handleResponse(res);
};

export const getSingleRecord = async (id) => {
    const res = await fetchWithTimeout(
        `${API_URL}/api/records/${id}`,
        {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
        }
    );

    return handleResponse(res);
};

export const deleteRecord = async (id) => {
    const res = await fetchWithTimeout(
        `${API_URL}/api/records/${id}`,
        {
            method: "DELETE",
            headers: getHeaders(),
            credentials: "include",
        }
    );

    return handleResponse(res);
};

export const getPatients = async () => {

    const res = await fetchWithTimeout(
        `${API_URL}/api/patients`,
        {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
        }
    );

    return handleResponse(res);
};


export const createPatient = async (patientData) => {

    const res = await fetchWithTimeout(
        `${API_URL}/api/patients`,
        {
            method: "POST",
            headers: {
                ...getHeaders(),
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(patientData),
        }
    );

    return handleResponse(res);
};

export const getMe = async () => {
    const res = await fetchWithTimeout(
        `${API_URL}/api/auth/session`,
        {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
        }
    );
    return handleResponse(res);
};

export const signInUser = async (email, password) => {
    // 1. Fetch CSRF token
    const csrfRes = await fetchWithTimeout(
        `${API_URL}/api/auth/csrf`,
        {
            method: "GET",
            headers: getHeaders(),
            credentials: "include",
        }
    );
    const { csrfToken } = await handleResponse(csrfRes);

    // 2. Perform credentials sign in
    const res = await fetchWithTimeout(
        `${API_URL}/api/auth/callback/credentials`,
        {
            method: "POST",
            headers: {
                ...getHeaders(),
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                email,
                password,
                csrfToken,
                callbackUrl: "/dashboard",
                json: "true",
            }),
            credentials: "include",
        }
    );

    return handleResponse(res);
};

export const signUpUser = async (username, email, password) => {
    const res = await fetchWithTimeout(
        `${API_URL}/api/signup`,
        {
            method: "POST",
            headers: {
                ...getHeaders(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, email, password }),
            credentials: "include",
        }
    );

    return handleResponse(res);
};