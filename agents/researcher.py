import os
import requests

def gather_evidence(claim):
    """
    Uses Tavily API to retrieve evidence for a specific claim.
    """
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    url = "https://api.tavily.com/search"

    payload = {
        "api_key": tavily_api_key,
        "query": claim,
        "search_depth": "advanced", # "advanced" goes deeper for better facts
        "include_answer": False,
        "include_images": False,
        "include_raw_content": False,
        "max_results": 3 # Keep it to top 3 to avoid overloading the Judge Agent's context window
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        # Format the evidence into a clean string for the Judge Agent
        evidence_text = ""
        for i, result in enumerate(data.get('results', [])):
            evidence_text += f"Source {i+1} ({result['url']}):\n{result['content']}\n\n"
            
        return evidence_text.strip()

    except Exception as e:
        print(f"Search Error for claim '{claim}': {e}")
        return "Error retrieving evidence."