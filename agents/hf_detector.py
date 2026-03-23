import os
import base64
import tempfile
from huggingface_hub import InferenceClient

def detect_with_hf(base64_image_data):
    """
    Sends the image to prithivMLmods/Deep-Fake-Detector-v2-Model via Hugging Face InferenceClient.
    """
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        return {"hf_score": 0, "status": "error: Missing HF_TOKEN"}

    # 1. Clean the base64 string and determine the file extension
    if "," in base64_image_data:
        header, base64_image_data = base64_image_data.split(",", 1)
    else:
        header = "data:image/jpeg;base64" # Fallback
        
    ext = ".png" if "png" in header else ".jpg"
    image_bytes = base64.b64decode(base64_image_data)

    # 2. Save the bytes to a temporary file so the InferenceClient can read the MIME type
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_img:
        temp_img.write(image_bytes)
        temp_path = temp_img.name

    try:
        # Initialize the Inference Client
        client = InferenceClient(
            provider="hf-inference",
            api_key=hf_token,
        )

        # 3. Pass the file path (instead of raw bytes)
        output = client.image_classification(
            temp_path, 
            model="prithivMLmods/Deepfake-Detect-Siglip2"
        )

        # 4. Parse the output
        fake_score = 0.0
        for item in output:
            # Check for the 'Fake' label (case-insensitive)
            if "FAKE" in item.label.upper():
                fake_score = item.score

        # Convert to a 0-100 percentage
        ai_score_percent = int(round(fake_score * 100))
        
        # Calculate confidence interval
        if ai_score_percent >= 80 or ai_score_percent <= 20:
            confidence = "High"
        elif ai_score_percent >= 60 or ai_score_percent <= 40:
            confidence = "Medium"
        else:
            confidence = "Low"

        return {
            "hf_score": ai_score_percent,
            "confidence": confidence,
            "status": "success"
        }

    except Exception as e:
        print(f"HF InferenceClient Error: {e}")
        return {"hf_score": 0, "confidence": "N/A", "status": f"error: {str(e)}"}
        
    finally:
        # 5. Clean up the temporary file from the server
        if os.path.exists(temp_path):
            os.remove(temp_path)