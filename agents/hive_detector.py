"""
Stage 2: Hive AI-Generated Image Detection via NVIDIA NIM API
Purpose-built ML classifier trained on millions of real and AI images.
"""
import os
import requests


def detect_with_hive(base64_image_data):
    """
    Send an image to the Hive AI-Generated Image Detection NIM endpoint.
    Returns a structured result with the AI-generated probability (0-100).
    """
    nim_api_key = os.getenv("NIM_API_KEY")
    url = "https://ai.api.nvidia.com/v1/cv/hive/ai-generated-image-detection"

    headers = {
        "Authorization": f"Bearer {nim_api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # Ensure the image has a proper data-URL prefix
    image_payload = base64_image_data
    if not image_payload.startswith("data:image"):
        image_payload = f"data:image/jpeg;base64,{image_payload}"

    payload = {
        "input": [image_payload]
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()

        # Parse the Hive response structure
        ai_score = 0.0
        raw_classes = []

        if isinstance(data, dict):
            # Check for the nested "data" array format (Standard NVIDIA NIM CV)
            if "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
                result = data["data"][0]
                
                # Format A: 'is_ai_generated' and 'possible_sources'
                if "is_ai_generated" in result:
                    ai_score = float(result.get("is_ai_generated", 0.0))
                    sources = result.get("possible_sources", {})
                    if isinstance(sources, dict):
                        for k, v in sources.items():
                            raw_classes.append({"class": k, "score": round(v, 4)})
                            
                # Format B (Legacy Fallback): 'classes' array
                elif "classes" in result:
                    for cls in result.get("classes", []):
                        class_name = cls.get("class", "").lower()
                        score = cls.get("score", 0)
                        raw_classes.append({"class": class_name, "score": round(score, 4)})
                        if "ai_generated" in class_name and "not" not in class_name:
                            ai_score = max(ai_score, score)

            # Check for the flat response format
            elif "is_ai_generated" in data:
                ai_score = float(data.get("is_ai_generated", 0.0))
                sources = data.get("possible_sources", {})
                if isinstance(sources, dict):
                    for k, v in sources.items():
                        raw_classes.append({"class": k, "score": round(v, 4)})

        # Convert to 0-100 scale
        hive_score = int(round(ai_score * 100))

        # Determine confidence based on absolute decisiveness
        if ai_score >= 0.80 or ai_score <= 0.20:
            confidence = "High"
        elif ai_score >= 0.60 or ai_score <= 0.40:
            confidence = "Medium"
        else:
            confidence = "Low"

        return {
            "hive_score": hive_score,
            "confidence": confidence,
            "ai_generated_prob": ai_score,
            "raw_classes": raw_classes,
            "status": "success"
        }

    except requests.exceptions.HTTPError as e:
        error_msg = str(e)
        try:
            error_body = e.response.json() if e.response else {}
            error_msg = error_body.get("detail", str(e))
        except Exception:
            pass
        print(f"Hive API Error: {error_msg}")
        return {
            "hive_score": 0,
            "confidence": "N/A",
            "ai_generated_prob": 0,
            "raw_classes": [],
            "status": f"error: {error_msg}"
        }
    except Exception as e:
        print(f"Hive Detection Error: {e}")
        return {
            "hive_score": 0,
            "confidence": "N/A",
            "ai_generated_prob": 0,
            "raw_classes": [],
            "status": f"error: {str(e)}"
        }