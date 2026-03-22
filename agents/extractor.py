import os
import requests
import json

def extract_claims(text):
    """
    Uses NVIDIA NIM API to extract discrete, verifiable claims with Context Binding.
    """
    nim_api_key = os.getenv("NIM_API_KEY")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {nim_api_key}",
        "Content-Type": "application/json"
    }

    # UPGRADED PROMPT: Added Rule 5 to destroy chat filler, timestamps, and UI artifacts
    system_prompt = """
    You are an expert Fact-Checking Claim Extractor.
    Your task is to decompose the user's input text into discrete, verifiable, atomic statements.
    
    CRITICAL INSTRUCTION - CONTEXTUAL BINDING (ENTITY RESOLUTION):
    1. Atomic Independence: Every extracted claim MUST be fully verifiable on its own without needing to read the surrounding claims.
    2. Resolve Pronouns: Replace all pronouns (he, she, it, they, his, her) with the explicit name or subject from the text.
    3. Bind Context (For Localized Events): If the text describes a specific event, you MUST append the core subject, location, and time to every sub-claim that lacks it. 
    4. Exemption (For Universal Facts): If a statement is a universal, timeless fact (e.g., "Water boils at 100C" or "The Eiffel Tower is in Paris"), do NOT append localized context.
    5. Drop Conversational Filler: Completely ignore greetings, timestamps (e.g., '01:18'), UI text, usernames, and conversational filler (e.g., 'Hey check the news'). Extract ONLY the core verifiable factual claims.
    6. Format OCR Text: Insert proper punctuation and grammatical breaks when extracting raw OCR text. Convert ALL CAPS text into standard sentence case.
    
    Output STRICTLY in JSON format as a list of strings. Example: ["Claim 1", "Claim 2"]
    """

    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Extract claims from the following text:\n\n{text}"}
        ],
        "temperature": 0.1, 
        "max_tokens": 1024,
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        
        content = result['choices'][0]['message']['content']
        parsed_content = json.loads(content)
        
        if isinstance(parsed_content, dict):
             return list(parsed_content.values())[0]
        return parsed_content

    except Exception as e:
        print(f"Extraction Error: {e}")
        return []