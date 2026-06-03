import requests

url = "http://localhost:8000/process-note"
payload = {
    "text": "Test note for service connectivity.",
    "explain": True,
}

resp = requests.post(url, json=payload, timeout=10)
print("status", resp.status_code)
print("content-type", resp.headers.get("content-type"))
print("text:", repr(resp.text[:800]))

try:
    data = resp.json()
    print("json type", type(data))
    print("json keys", list(data.keys()) if isinstance(data, dict) else None)
    print("icd10 type", type(data.get("icd10")) if isinstance(data, dict) else None)
    print("cpt type", type(data.get("cpt")) if isinstance(data, dict) else None)
except Exception as e:
    print("json error", type(e).__name__, e)
