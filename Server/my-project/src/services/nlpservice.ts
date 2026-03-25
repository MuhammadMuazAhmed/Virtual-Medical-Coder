export async function processClinicalNote(note: string) {
    try {
        const response = await fetch("http://127.0.0.1:8000/process-note", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: note }),
        });

        const data = await response.json();

        return data;
    } catch (error) {
        console.error("Error connecting to NLP service:", error);
        throw error;
    }
}