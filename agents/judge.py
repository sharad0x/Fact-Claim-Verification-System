import os
import requests
import json

def evaluate_claim(claim, evidence):
    """
    Uses NVIDIA NIM API to evaluate a claim against retrieved evidence,
    generating a verdict, confidence score, evidence context, and citations.
    """
    nim_api_key = os.getenv("NIM_API_KEY")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {nim_api_key}",
        "Content-Type": "application/json"
    }

    system_prompt = """
    You are an expert, impartial Fact-Checking Judge. 
    You will be provided with a single 'Claim' and a block of 'Evidence' retrieved from the web.
    
    Evaluate the claim based strictly on the provided evidence. Do not use outside knowledge.
    
    Output a STRICT JSON object with the following keys:
    - "verdict": Must be exactly one of ["True", "False", "Partially True", "Unverifiable"].
    - "confidence_score": An integer from 0 to 100 representing your confidence in this verdict.
    - "evidence_context": A brief, objective 1-2 sentence summary of the exact web evidence or facts you found that relate to this claim. (e.g., "Web sources indicate that...")
    - "reasoning": Your analysis explaining why the evidence proves or disproves the claim.
    - "citations": A list of URLs from the evidence that support your verdict. If unverifiable, return [].
    """

    user_prompt = f"Claim: {claim}\n\nEvidence:\n{evidence}"

    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1, 
        "max_tokens": 512,
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        return json.loads(result['choices'][0]['message']['content'])

    except Exception as e:
        print(f"Judgment Error for claim '{claim}': {e}")
        return {
            "verdict": "Error",
            "confidence_score": 0,
            "evidence_context": "Failed to retrieve or process context.",
            "reasoning": "The verification engine encountered an API error.",
            "citations": []
        }