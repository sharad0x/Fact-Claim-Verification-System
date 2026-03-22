import os
import requests
import json

def evaluate_claim(claim, evidence):
    """
    Evaluates a claim against retrieved evidence using Chain of Thought and Self-Reflection.
    """
    nim_api_key = os.getenv("NIM_API_KEY")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {nim_api_key}",
        "Content-Type": "application/json"
    }

    # UPGRADED PROMPT: Forces the LLM to write out its thinking and critique itself BEFORE judging.
    system_prompt = """
    You are an expert Fact-Checking Judge. Your task is to evaluate a claim against the provided evidence.
    
    You MUST use a rigorous Chain of Thought and Self-Reflection process before reaching a final verdict.
    
    Step 1 (chain_of_thought): Objectively analyze the claim. Then, map specific sentences from the evidence to the claim's assertions.
    Step 2 (self_critique): Act as a harsh critic. Ask yourself: "Does the evidence explicitly prove/disprove this, or am I making dangerous assumptions? Are the sources talking about the exact same time period and entity?"
    Step 3 (verdict): Decide the final status based STRICTLY on the outcome of your critique.
    
    Options for Verdict: "True", "False", "Partially True", "Unverifiable".
    If the evidence is unrelated, contradictory, or insufficient, you MUST choose "Unverifiable".
    
    Output STRICTLY in JSON format:
    {
      "chain_of_thought": "Your step-by-step analysis mapping evidence to the claim.",
      "self_critique": "Your critical reflection checking for your own assumptions or timeline mismatches.",
      "verdict": "True | False | Partially True | Unverifiable",
      "confidence_score": 0-100,
      "evidence_context": "A 1-2 sentence summary of what the evidence actually says.",
      "reasoning": "A concise explanation for the user of why this verdict was reached.",
      "citations": ["url1", "url2"]
    }
    """

    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Claim: {claim}\n\nEvidence:\n{evidence}"}
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
        "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        
        # Parse the JSON response
        content = response.json()['choices'][0]['message']['content']
        result = json.loads(content)
        
        # Ensure citations is always a list
        if "citations" not in result or not isinstance(result["citations"], list):
            result["citations"] = []
            
        return result
        
    except Exception as e:
        print(f"Judging Error: {e}")
        return {
            "verdict": "Error",
            "confidence_score": 0,
            "evidence_context": "Failed to evaluate due to system error.",
            "reasoning": str(e),
            "citations": []
        }