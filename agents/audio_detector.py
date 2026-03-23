import os
import base64
import tempfile
import json
import requests
from pydub import AudioSegment
from pydub.silence import detect_silence

# Import the local pipeline
from transformers import pipeline

# Load the model into memory globally when the server starts
print("Loading local audio deepfake model (mo-thecreator/Deepfake-audio-detection)...")
try:
    audio_classifier = pipeline("audio-classification", model="mo-thecreator/Deepfake-audio-detection")
except Exception as e:
    print(f"Failed to load audio model: {e}")
    audio_classifier = None

def analyze_audio(audio_data_uri, filename, progress_callback=None):
    def _emit(msg):
        if progress_callback:
            progress_callback(msg)

    # ─── STAGE 1: PREPROCESSING & ACOUSTIC ANALYSIS ───────────────
    _emit("Stage 1/3: Preprocessing (16kHz, Mono) & Acoustic Analysis...")
    
    try:
        header, encoded = audio_data_uri.split(",", 1)
        audio_bytes = base64.b64decode(encoded)
        ext = ".m4a" if "m4a" in header else ".mp3" if "mp3" in header else ".wav"

        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_audio:
            temp_audio.write(audio_bytes)
            temp_path = temp_audio.name
            
        # Preprocessing: Resample to 16kHz, Mono conversion
        audio = AudioSegment.from_file(temp_path)
        audio = audio.set_frame_rate(16000).set_channels(1)
        
        processed_path = temp_path + "_16k.wav"
        audio.export(processed_path, format="wav")
        
        # Acoustic Analysis: duration, volume, and breathing/pauses
        duration_sec = len(audio) / 1000.0
        dbfs = audio.dBFS
        silences = detect_silence(audio, min_silence_len=300, silence_thresh=audio.dBFS-16)
        pause_count = len(silences)
        
        # Acoustic heuristic
        acoustic_suspicion = 0
        if pause_count == 0 and duration_sec > 5:
            acoustic_suspicion = 80
        elif pause_count < 2 and duration_sec > 10:
            acoustic_suspicion = 50
            
        acoustic_summary = f"Duration: {duration_sec:.1f}s, Avg Vol: {dbfs:.1f}dB, Natural Pauses: {pause_count}. Suspicion: {acoustic_suspicion}/100"
        _emit(f"Stage 1/3 complete — {acoustic_summary}")
        
    except Exception as e:
        _emit(f"Stage 1/3 Error: {e}")
        return _error_response(f"Acoustic preprocessing failed: {e}")

    # ─── STAGE 2: AI VOICE MODEL (LOCAL TRANSFORMERS) ─────────────
    _emit("Stage 2/3: Running local AI Voice Probability Model...")
    hf_score = 0
    hf_status = "error"
    
    if not audio_classifier:
        _emit("Stage 2/3 degraded — Local model failed to load.")
    else:
        try:
            # Run inference locally using the pipeline
            output = audio_classifier(processed_path)
            
            # The pipeline returns a list of dictionaries: [{'label': 'fake', 'score': 0.99}, ...]
            fake_prob = 0.0
            for item in output:
                label = item["label"].lower()
                # Catch fake/spoof labels
                if "fake" in label or "spoof" in label:
                    fake_prob = item["score"]
            
            hf_score = int(round(fake_prob * 100))
            hf_status = "success"
            _emit(f"Stage 2/3 complete — Local Model AI Probability: {hf_score}%")
        except Exception as e:
            _emit(f"Stage 2/3 degraded — Local Model error: {e}")

    # ─── STAGE 3: LLM SYNTHESIS (THE JUDGE) ───────────────────────
    _emit("Stage 3/3: LLM Decision Layer analyzing speech naturalness...")
    nim_api_key = os.getenv("NIM_API_KEY")
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {nim_api_key}", "Content-Type": "application/json"}
    
    system_prompt = """
    You are an expert Audio Deepfake Forensics Judge. Determine the final probability that an audio clip is AI-generated (0-100).
    
    Evidence:
    1. AI Voice Model Score (0-100% FAKE).
    2. Acoustic Analysis (Breathing, pauses, frequency consistency).
    
    RULES:
    - AI voices often lack natural breathing pauses or have unnatural volume consistency.
    - If the Model Score is high AND Acoustic Analysis shows robotic traits (0 or very few pauses in a long clip), the clip is highly likely FAKE.
    - If the Model Score is high BUT Acoustic Analysis shows natural human traits (many pauses, varied volume), lower the final score slightly to account for model hallucination.
    - If both agree it's real, keep it low.
    
    Output STRICTLY in JSON:
    {
      "reasoning": "A 1-2 sentence explanation weighing the model vs acoustic features.",
      "final_score": <int 0-100>
    }
    """
    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Model Score: {hf_score}%\nAcoustic Analysis: {acoustic_summary}"}
        ],
        "temperature": 0.1,
        "max_tokens": 256,
        "response_format": {"type": "json_object"}
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        result = json.loads(response.json()['choices'][0]['message']['content'])
        final_score = int(result.get("final_score", hf_score))
        llm_reasoning = result.get("reasoning", "Synthesized via LLM.")
        llm_status = "success"
        _emit(f"Stage 3/3 complete — Final Verdict Score: {final_score}/100")
    except Exception as e:
        final_score = hf_score
        llm_reasoning = "LLM Synthesis failed. Defaulting to base model."
        llm_status = "error"
        _emit("Stage 3/3 degraded — LLM error.")

    # ─── CLEANUP & RESPONSE FORMATTING ────────────────────────────
    try:
        os.remove(temp_path)
        os.remove(processed_path)
    except:
        pass

    if final_score >= 70 or final_score <= 30:
        confidence = "High"
    elif final_score >= 55 or final_score <= 45:
        confidence = "Medium"
    else:
        confidence = "Low"

    return {
        "media_type": "audio",
        "media_ai_score": final_score,
        "confidence_level": confidence,
        "visual_analysis": f"[LLM JUDGE: {confidence.upper()} CONFIDENCE] {llm_reasoning}",
        "extracted_text": "",
        "pipeline_details": {
            "stage1_acoustic": {
                "score": acoustic_suspicion,
                "summary": acoustic_summary
            },
            "stage2_hf": {
                "score": hf_score,
                "status": hf_status,
                "summary": "Local Transformers Model (mo-thecreator)"
            },
            "stage3_synthesis": {
                "score": final_score,
                "status": llm_status,
                "summary": llm_reasoning
            }
        }
    }

def _error_response(msg):
    return {
        "media_type": "audio",
        "media_ai_score": 0,
        "confidence_level": "N/A",
        "visual_analysis": msg,
        "extracted_text": "",
        "pipeline_details": {
            "stage1_acoustic": {"score": 0, "summary": "Analysis Failed"}
        }
    }