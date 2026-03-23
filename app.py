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
    files = data.get("files", [])

    if not raw_text and not files:
        return jsonify({"error": "No input provided"}), 400

    def generate():
        def sse_message(payload):
            return f"data: {json.dumps(payload)}\n\n"

        try:
            # Create a unified processing queue
            processing_queue = []
            if raw_text:
                processing_queue.append({
                    "type": "url" if input_type == "url" else "text",
                    "data": raw_text,
                    "name": "URL Content" if input_type == "url" else "Text Input"
                })
            processing_queue.extend(files)

            master_claims_list = []
            ai_media_results = []
            verification_text_all = ""

            # --- PHASE 1: ITEM-BY-ITEM PROCESSING (Media Analysis & Claim Extraction) ---
            for item in processing_queue:
                item_type = item.get("type", "").lower()
                item_data = item.get("data", "")
                item_name = item.get("name", "Input")
                item_text = ""

                # 1A. Local Media Analysis & Text Parsing
                if "image" in item_type:
                    yield sse_message({"step": "system", "message": f"Agent 0b: Running deepfake forensics on {item_name}..."})
                    
                    pipeline_msgs = []
                    result = analyze_image(item_data, progress_callback=lambda m: pipeline_msgs.append(m))
                    for m in pipeline_msgs: yield sse_message({"step": "system", "message": f"  ↳ {m}"})
                    
                    result["filename"] = item_name
                    ai_media_results.append(result)
                    
                    # Capture OCR text
                    vlm_text = result.get("extracted_text", "").strip()
                    if vlm_text:
                        yield sse_message({"step": "system", "message": f"Triage: OCR Text detected in {item_name}."})
                        item_text = vlm_text

                elif "audio" in item_type:
                    yield sse_message({"step": "system", "message": f"Agent 0c: Running Audio Forensics on {item_name}..."})
                    
                    pipeline_msgs = []
                    result = analyze_audio(item_data, item_name, progress_callback=lambda m: pipeline_msgs.append(m))
                    for m in pipeline_msgs: yield sse_message({"step": "system", "message": f"  ↳ {m}"})
                    
                    result["filename"] = item_name
                    ai_media_results.append(result)

                    yield sse_message({"step": "system", "message": f"Parser: Transcribing audio from {item_name}..."})
                    doc_text, _ = parse_document(item_data, item_name)
                    if doc_text:
                        item_text = doc_text

                elif item_type == "url":
                    yield sse_message({"step": "system", "message": f"Parser: Scraping URL..."})
                    item_text = scrape_url(item_data)

                elif item_type == "text":
                    item_text = item_data

                else: # Standard Document
                    yield sse_message({"step": "system", "message": f"Parser: Extracting text from {item_name}..."})
                    doc_text, extracted_imgs = parse_document(item_data, item_name)
                    item_text = doc_text
                    
                    # Process any images embedded inside the PDF
                    if extracted_imgs:
                        yield sse_message({"step": "system", "message": f"Parser: Found {len(extracted_imgs)} embedded image(s)."})
                        for ext_img in extracted_imgs:
                            ext_name = ext_img.get("name", "Embedded Image")
                            yield sse_message({"step": "system", "message": f"Agent 0b: Forensics on {ext_name}..."})
                            
                            pipeline_msgs = []
                            img_res = analyze_image(ext_img["data"], progress_callback=lambda m: pipeline_msgs.append(m))
                            for m in pipeline_msgs: yield sse_message({"step": "system", "message": f"  ↳ {m}"})
                            
                            img_res["filename"] = ext_name
                            ai_media_results.append(img_res)
                            
                            # Append embedded image OCR back into the document text
                            if img_res.get("extracted_text"):
                                item_text += f"\n\n[Embedded Graphic OCR: {ext_name}]\n{img_res['extracted_text']}"

                # 1B. Local Claim Extraction (Strict Context Binding per item)
                if item_text and item_text.strip():
                    verification_text_all += f"\n\n[SOURCE: {item_name}]\n{item_text}"
                    
                    yield sse_message({"step": "system", "message": f"Agent 1a: Triaging and extracting claims from {item_name}..."})
                    routing_decision = triage_input(item_text)
                    
                    # Extract claims using ONLY the text from this specific document
                    claims = [item_text.strip()] if routing_decision.get("route") == "single_event" else extract_claims(item_text)
                    
                    if claims:
                        master_claims_list.extend(claims)

            # --- PHASE 2: GLOBAL UI SYNC ---
            if not master_claims_list and not ai_media_results:
                yield sse_message({"step": "error", "message": "No verifiable claims or media found."})
                return

            if master_claims_list:
                # Emit claims all at once so the Javascript frontend generates the Tracker UI correctly
                yield sse_message({"step": "claims_extracted", "claims": master_claims_list})

            # --- PHASE 3: GLOBAL AI TEXT DETECTION ---
            ai_text_results = None
            if verification_text_all.strip():
                yield sse_message({"step": "system", "message": "Agent 0a: Running global AI Text Analysis..."})
                # Analyze the combined text for AI generation markers (capped to prevent token limits)
                ai_text_results = detect_ai_content(verification_text_all.strip()[:15000])

            # --- PHASE 4: THE FACT CHECKING LOOP ---
            results = []
            for i, claim in enumerate(master_claims_list):
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