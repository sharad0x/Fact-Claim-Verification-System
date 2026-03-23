# 🔍 Automated Fact-Checking & Deepfake Analysis Engine

An advanced, multi-agent AI pipeline designed to verify claims, debunk misinformation, and detect synthetic media across omni-channel inputs. Whether you provide raw text, a batch of PDFs, a web article, or raw audio streams, this engine autonomously parses the content, extracts verifiable claims, runs mathematical forensics, and provides a cited, highly granular accuracy report.

## ✨ Key Features

* **Multi-Document Omni-Input Processing:** Seamlessly upload and process batches of mixed media simultaneously. The engine natively handles raw text, URLs, Documents (PDF/DOCX), Images, and Audio (.mp3, .wav, .m4a). It actively extracts embedded images and text from within PDFs using PyMuPDF and LlamaParse.
* **3-Stage Image Deepfake Forensic Pipeline:**
    * **Stage 1 (Local Math & Forensics):** Uses deterministic mathematical analysis (Error Level Analysis, Fast Fourier Transform, and EXIF metadata extraction) to find synthetic pixel anomalies locally without APIs.
    * **Stage 2 (Hugging Face Vision Inference):** Queries state-of-the-art Hugging Face vision transformers (e.g., Siglip2) for deepfake probability scoring.
    * **Stage 3 (LLM Decision Synthesis):** A Llama 3.3 Text LLM acts as the final judge, weighing the mathematical forensics against the ML model's probability to prevent "domain shift" hallucinations and bypass PII/Face-detection safety blocks.
* **3-Stage Audio Deepfake Pipeline:**
    * **Stage 1 (Acoustic Preprocessing):** Standardizes audio to 16kHz Mono and runs programmatic biological checks (breathing cadence, silence/pause detection) using `pydub`.
    * **Stage 2 (Local Transformers Model):** Runs a local Wav2Vec2/RawNet2 audio classification pipeline directly in system memory to detect synthetic voice cloning without network latency.
    * **Stage 3 (LLM Decision Synthesis):** Analyzes the acoustic footprint and model probability to determine speech naturalness and finalize the verdict.
* **Multi-Agent Fact-Checking Ecosystem:**
    * **The Extractor:** Context-bound claim extraction ensures pronouns, locations, and temporal data (dates) are perfectly bound to their atomic claims, even when reading across multiple differing documents.
    * **The Researcher:** Uses Tavily's search API to scour the live internet for primary sources and evidence.
    * **The Judge:** Llama 3.3 70B utilizes Chain-of-Thought and Self-Critique to assign a final verdict (True, False, Partially True, Unverifiable) based strictly on retrieved evidence.
* **High-Fidelity PDF Reporting:** Generates a deterministic, flexbox-optimized PDF intelligence report directly in the browser via `html2pdf.js`, preserving dark-mode UI, pipeline breakdown stages, and specific claim reasoning.

## 🛠️ Tech Stack Architecture

**Frontend:** HTML5, CSS3 (Custom Dark Theme), Vanilla JavaScript, SSE (Server-Sent Events) for live pipeline tracking, `html2pdf.js` for exporting.
**Backend Core:** Python 3.10+, Flask.
**AI & Inference:**
* Meta Llama 3.3 70B Instruct (Reasoning, Extraction, Judging) via NVIDIA NIM.
* Meta Llama 3.2 90B Vision (OCR & Visual Context Triage) via NVIDIA NIM.
* Hugging Face `InferenceClient` (Image Deepfake Probability).
* Hugging Face `transformers` & `torch` (Local Audio Deepfake Inference).
* Tavily Search API (Live Web Grounding).
**Forensics & Parsing:** LlamaParse (LlamaCloud), `PyMuPDF` (`fitz`), Pillow, NumPy, `pydub`.

## 📸 Demo: Social Media Post Analysis

The engine is highly capable of evaluating complex, multi-modal inputs like social media graphics containing both imagery and text.

**1. Omni-Input Ingestion:**
The user uploads a screenshot of a viral news graphic. The system instantly begins processing it through the Live Agent Terminal.
<br>
<img src="assets/1.png" alt="Omni-Input UI" width="800"/>

**2. Deepfake Analysis & OCR:**
The pipeline evaluates the image. It successfully extracts the embedded text via OCR while simultaneously running the 3-stage deepfake analysis on the visual components.
<br>
<img src="assets/2.png" alt="Deepfake & AI Content Breakdown" width="800"/>

**3. Granular Fact-Checking:**
The extracted OCR text is broken down into verifiable claims. The Researcher Agent queries the web, and the Judge Agent delivers a cited verdict based on real-world news sources. 
<br>
<img src="assets/3.png" alt="Verification Breakdown" width="800"/>

---

## 🛠️ Project Setup Guide

### Prerequisites
* Python 3.10+
* API Keys for NVIDIA NIM, HuggingFace, LlamaCloud, and Tavily.

### 1. Clone the Repository
```bash
git clone https://github.com/sharad0x/Fact-Claim-Verification-System.git
cd Fact-Claim-Verification-System
```

### 2. Install Dependencies
Make sure you have Pillow and numpy installed for the local forensic math engine to function correctly.
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory and add your API keys.
- `NIM_API_KEY`: Required for Llama 3.3 70B (Text Agents), Llama 3.2 90B (Vision Agent), and the Hive ML Classifier. Get it from [NVIDIA build](https://build.nvidia.com/).
- `LLAMA_CLOUD_API_KEY`: Required for parsing PDFs and complex documents. Get it from [LlamaIndex](https://cloud.llamaindex.ai/).
- `TAVILY_API_KEY`: Required for the Researcher Agent to fetch live web data. Get it from [Tavily](https://www.tavily.com/).
- HF_TOKEN: Required for the image deepfake pipeline to query the Hugging Face Serverless Inference API. Get it from [Hugging Face](https://huggingface.co/).

.env Example:
```
NIM_API_KEY="nvapi-your-nim-key-here"
TAVILY_API_KEY="tvly-your-tavily-key-here"
LLAMA_CLOUD_API_KEY="llx-your-llama-cloud-key-here"
HF_TOKEN="hf_your_hugging_face_token_here"
```

### 4. Run the Application
Launch the Flask server.
```
python app.py
```
Open your browser and navigate to http://127.0.0.1:5000. On the first launch, the transformers library will automatically download the required audio models to your local cache.

## ⚖️ Disclaimer
This system leverages heuristic mathematics and generative AI probabilities to determine content authenticity. It is designed as an investigative tool to augment human research, not as an absolute arbiter of truth. Always verify critical claims independently.