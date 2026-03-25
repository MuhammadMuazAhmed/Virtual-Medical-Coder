from fastapi import FastAPI

app = FastAPI()

@app.post("/process-note")
def process_note(data: dict):

    text = data["text"]

    # simple logic for now
    entities = []
    codes = []

    if "diabetes" in text.lower():
        entities.append("diabetes")
        codes.append("E11")

    return {
        "entities": entities,
        "codes": codes
    }