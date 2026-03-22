import os
import requests
import json

def triage_input(text):
    """
    Analyzes the input text to determine if it should be verified as a single cohesive 
    news event (headline) or split into multiple atomic claims (article/paragraph).
    """
    nim_api_key = os.getenv("NIM_API_KEY")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {nim_api_key}",
        "Content-Type": "application/json"
    }

    # UPGRADED PROMPT: Forces messy OCR/Chat text to be routed to the Extractor
    system_prompt = """
    You are an expert AI Triage Agent for a Fact-Checking pipeline.
    Analyze the user's input text and categorize its structural complexity.
    
    Categories:
    1. "single_event": The text is a cleanly written short headline, a single continuous factual sentence, or describes one cohesive event WITHOUT conversational filler. It should be verified as a whole piece.
    2. "multi_claim": The text is a paragraph, contains multiple facts, OR contains conversational filler, timestamps, messy OCR text, or chat messages (e.g., "Hey look at this"). These MUST be routed here so the extraction agent can clean them.
    
    Output STRICTLY in JSON format:
    {
      "route": "single_event" | "multi_claim",
      "reasoning": "A 1-sentence explanation for this routing decision."
    }
    """

    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Categorize this text:\n\n{text}"}
        ],
        "temperature": 0.1,
        "max_tokens": 128,
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return json.loads(response.json()['choices'][0]['message']['content'])
    except Exception as e:
        print(f"Routing Error: {e}")
        return {"route": "multi_claim", "reasoning": "Error occurred, defaulting to atomic extraction."}