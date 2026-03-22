import os
import base64
import tempfile
import json
import google.generativeai as genai

def analyze_audio(audio_data_uri, filename, progress_callback=None):
    def _emit(msg):
        if progress_callback:
            progress_callback(msg)

    _emit("Stage 1: Decoding Audio Stream...")
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return _error_response("GEMINI_API_KEY is missing from your .env file.")

    try:
        # Decode the base64 audio from the UI
        header, encoded = audio_data_uri.split(",", 1)
        audio_bytes = base64.b64decode(encoded)
        ext = ".m4a" if "m4a" in header else ".mp3" if "mp3" in header else ".wav"

        # Save temporarily for the Gemini API to upload
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name

    except Exception as e:
        return _error_response(f"Audio decoding failed: {e}")

    _emit("Stage 2: Uploading to Multimodal LLM (Gemini 2.5)...")
    
    try:
        genai.configure(api_key=api_key)
        
        # Upload the audio file to Google's servers
        audio_file = genai.upload_file(path=temp_path)
        
        _emit("Stage 3: Running Multimodal Deepfake Analysis...")
        
        # Configure the model to STRICTLY return JSON
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            generation_config={"response_mime_type": "application/json"}
        )
        
        prompt = """
        You are an expert audio forensic analyst. Listen to the provided audio file.
        Analyze the voice for signs of AI generation, synthetic voice cloning (like ElevenLabs), robotic phasing, or unnatural breathing cadence.
        
        You MUST return a valid JSON object with EXACTLY these three keys:
        - "ai_score": An integer from 0 to 100 representing the probability that the audio is AI-generated (100 = definitely AI, 0 = definitely human).
        - "confidence": A string, either "High", "Moderate", or "Low".
        - "analysis": A 2-sentence explanation of what specific acoustic anomalies you heard (or didn't hear) that led to this score.
        """
        
        response = model.generate_content([prompt, audio_file])
        result = json.loads(response.text)
        
        # Clean up the file from Google's servers and local storage
        genai.delete_file(audio_file.name)
        os.remove(temp_path)
        
        ai_score = int(result.get("ai_score", 0))
        confidence = result.get("confidence", "Moderate")
        analysis = result.get("analysis", "Audio analyzed via multimodal LLM.")

        _emit(f"Analysis Complete. AI Probability: {ai_score}%")

        return {
            "media_type": "audio",
            "media_ai_score": ai_score,
            "confidence_level": confidence,
            "visual_analysis": analysis,
            "extracted_text": "", # Leave empty so LlamaParse handles transcription in app.py
            "pipeline_details": {
                "stage1_llm": {
                    "score": ai_score, 
                    "summary": "Native Audio Ingestion & Acoustic Reasoning"
                }
            }
        }

    except Exception as e:
        _emit(f"Multimodal API Error: {e}")
        if 'temp_path' in locals():
            os.remove(temp_path)
        return _error_response(f"LLM API Connection Failed: {e}")

def _error_response(msg):
    return {
        "media_type": "audio",
        "media_ai_score": 0,
        "confidence_level": "N/A",
        "visual_analysis": msg,
        "extracted_text": "",
        "pipeline_details": {
            "stage1_llm": {"score": 0, "summary": "Analysis Failed"}
        }
    }