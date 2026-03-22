import os
import json
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv

from agents.parser import scrape_url, parse_document
from agents.detector import detect_ai_content
from agents.audio_detector import analyze_audio
from agents.media_detector import analyze_image
from agents.router import triage_input
from agents.extractor import extract_claims
from agents.researcher import gather_evidence
from agents.judge import evaluate_claim

load_dotenv()
app = Flask(__name__)

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/api/verify', methods=['POST'])
def verify_claim_route():
    data = request.json
    input_type = data.get("type", "text")
    raw_text = data.get("text", "")
    
    # FIX: We now look for the 'files' array sent by the updated main.js
    files = data.get("files", [])

    # FIX: Check if either text or the files array exists
    if not raw_text and not files:
        return jsonify({"error": "No input provided"}), 400

    def generate():
        def sse_message(payload):
            return f"data: {json.dumps(payload)}\n\n"

        try:
            # --- PHASE 1: PRE-PROCESSING & OMNI-PARSING ---
            verification_text = raw_text

            if input_type == "url":
                yield sse_message({"step": "system", "message": "Parser: Scraping content from URL..."})
                verification_text = scrape_url(raw_text)

            # FIX: Loop through ALL uploaded documents and combine their text
            for f in files:
                file_type = f.get("type", "").lower()
                if "image" not in file_type:
                    yield sse_message({"step": "system", "message": f"Parser: Extracting text from '{f.get('name', 'document')}' via LlamaCloud..."})
                    doc_text = parse_document(f["data"], f.get("name", ""))
                    verification_text = f"{verification_text}\n\n{doc_text}".strip()

            # --- PHASE 2: MULTI-STAGE DEEPFAKE ANALYSIS PIPELINE ---
            ai_media_results = None
            
            # FIX: Filter out the images from the uploaded files array
            image_files = [f for f in files if "image" in f.get("type", "").lower()]
            
            if image_files:
                # Run the deepfake forensic pipeline on the PRIMARY image
                primary_image = image_files[0]
                yield sse_message({"step": "system", "message": f"Agent 0b: Initializing 3-stage forensic pipeline for {primary_image.get('name', 'image')}..."})
                
                pipeline_messages = []
                def pipeline_progress(msg):
                    pipeline_messages.append(msg)
                
                ai_media_results = analyze_image(primary_image["data"], progress_callback=pipeline_progress)
                
                for msg in pipeline_messages:
                    yield sse_message({"step": "system", "message": f"  ↳ {msg}"})
                
                extracted_text = ai_media_results.get("extracted_text", "").strip()
                if extracted_text:
                    yield sse_message({"step": "system", "message": f"Triage: Text detected in image. Extracting claims for verification..."})
                    verification_text = f"{verification_text}\n{extracted_text}".strip()
                
                score = ai_media_results.get('media_ai_score', 0)
                confidence = ai_media_results.get('confidence_level', 'N/A')
                yield sse_message({"step": "system", "message": f"Deepfake Analysis Complete. Ensemble score: {score}/100 ({confidence} confidence)"})
            
            # --- PHASE 2.5: AUDIO DEEPFAKE ANALYSIS ---
            audio_files = [f for f in files if "audio" in f.get("type", "").lower()]
            
            if audio_files:
                primary_audio = audio_files[0]
                yield sse_message({"step": "system", "message": f"Agent 0c: Initializing Audio Forensic pipeline for {primary_audio.get('name', 'audio')}..."})
                
                pipeline_messages = []
                def pipeline_progress(msg):
                    pipeline_messages.append(msg)
                
                ai_media_results = analyze_audio(primary_audio["data"], primary_audio["name"], progress_callback=pipeline_progress)
                
                for msg in pipeline_messages:
                    yield sse_message({"step": "system", "message": f"  ↳ {msg}"})
                
                # Because we set extracted_text to "" in audio_detector, this safely skips 
                # appending dummy text and lets LlamaParse's real text flow through!
                extracted_text = ai_media_results.get("extracted_text", "").strip()
                if extracted_text:
                    yield sse_message({"step": "system", "message": f"Triage: Speech detected. Transcribing audio for verification..."})
                    verification_text = f"{verification_text}\n{extracted_text}".strip()
                
                score = ai_media_results.get('media_ai_score', 0)
                confidence = ai_media_results.get('confidence_level', 'N/A')
                yield sse_message({"step": "system", "message": f"Audio Deepfake Analysis Complete. Ensemble score: {score}/100 ({confidence} confidence)"})
                
            # --- PHASE 3: TEXT ANALYSIS ---
            ai_text_results = None
            if verification_text.strip():
                yield sse_message({"step": "system", "message": "Agent 0a: Running AI Text Forensic Analysis..."})
                ai_text_results = detect_ai_content(verification_text)

            if not verification_text.strip():
                if ai_media_results:
                    yield sse_message({"step": "complete", "results": [], "ai_text_detection": None, "ai_media_detection": ai_media_results})
                else:
                    yield sse_message({"step": "error", "message": "No readable content found to verify."})
                return

            # --- PHASE 4: MULTI-AGENT VERIFICATION ---
            yield sse_message({"step": "system", "message": "Agent 1a: Triaging structural complexity..."})
            routing_decision = triage_input(verification_text)
            
            claims = [verification_text.strip()] if routing_decision.get("route") == "single_event" else extract_claims(verification_text)
            
            if not claims:
                yield sse_message({"step": "error", "message": "Failed to establish verifiable claims."})
                return
                
            yield sse_message({"step": "claims_extracted", "claims": claims})

            results = []
            for i, claim in enumerate(claims):
                yield sse_message({"step": "researching", "claim_index": i, "claim": claim})
                evidence = gather_evidence(claim)
                
                yield sse_message({"step": "judging", "claim_index": i, "claim": claim})
                judgment = evaluate_claim(claim, evidence)
                
                results.append({
                    "claim": claim,
                    "verdict": judgment.get("verdict", "Error"),
                    "confidence_score": judgment.get("confidence_score", 0),
                    "evidence_context": judgment.get("evidence_context", "No context found."),
                    "reasoning": judgment.get("reasoning", "No reasoning provided."),
                    "citations": judgment.get("citations", [])
                })

            yield sse_message({
                "step": "complete", 
                "results": results,
                "ai_text_detection": ai_text_results,
                "ai_media_detection": ai_media_results
            })

        except Exception as e:
            yield sse_message({"step": "error", "message": str(e)})

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)