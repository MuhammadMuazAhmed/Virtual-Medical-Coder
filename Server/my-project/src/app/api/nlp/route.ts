import { processClinicalNote } from "@/services/nlpservice";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const { note } = body;

        if (!note) {
            return Response.json({ error: "Note is required" }, { status: 400 });
        }

        // Call Python NLP
        const result = await processClinicalNote(note);

        return Response.json(result);
    } catch (error) {
        return Response.json({ error: "Server error" }, { status: 500 });
    }
}