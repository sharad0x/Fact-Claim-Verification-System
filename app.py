import os
import json
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv

from agents.parser import scrape_url, parse_document
from agents.detector import detect_ai_content
# FIX: Correctly importing analyze_image
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
    file_data = data.get("file")
    filename = data.get("filename", "")

    if not raw_text and not file_data:
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
            elif input_type == "document" and file_data:
                yield sse_message({"step": "system", "message": f"Parser: Extracting text from '{filename}' via LlamaCloud..."})
                verification_text = parse_document(file_data, filename)

            # --- PHASE 2: MULTI-STAGE DEEPFAKE ANALYSIS PIPELINE ---
            ai_media_results = None
            if (input_type == "image" or file_data) and "image" in str(file_data).lower():
                yield sse_message({"step": "system", "message": "Agent 0b: Initializing 3-stage forensic pipeline..."})
                
                pipeline_messages = []
                def pipeline_progress(msg):
                    pipeline_messages.append(msg)
                
                ai_media_results = analyze_image(file_data, progress_callback=pipeline_progress)
                
                for msg in pipeline_messages:
                    yield sse_message({"step": "system", "message": f"  ↳ {msg}"})
                
                # FIX: Decoupled Logic. Deepfake score is preserved, and text is checked independently.
                extracted_text = ai_media_results.get("extracted_text", "").strip()
                if extracted_text:
                    yield sse_message({"step": "system", "message": "Triage: Text detected in image. Extracting claims for verification..."})
                    verification_text = f"{verification_text}\n{extracted_text}".strip()
                
                score = ai_media_results.get('media_ai_score', 0)
                confidence = ai_media_results.get('confidence_level', 'N/A')
                yield sse_message({"step": "system", "message": f"Deepfake Analysis Complete. Ensemble score: {score}/100 ({confidence} confidence)"})

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