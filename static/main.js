let globalResultsData = [];
let attachedFileData = null; 

const inputText = document.getElementById('inputText');
const fileUpload = document.getElementById('fileUpload');
const filePreviewContainer = document.getElementById('filePreviewContainer');

// ── THEME TOGGLE ──────────────────────────────────────────
(function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
})();

// --- PIPELINE DROPDOWN LOGIC ---
document.getElementById('togglePipelineBtn').addEventListener('click', () => {
    const content = document.getElementById('pipelineContent');
    const chevron = document.getElementById('pipelineChevron');
    content.classList.toggle('hidden');
    chevron.classList.toggle('rotate-180');
});

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    if (isDark) {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

// ── OMNI-INPUT UX ─────────────────────────────────────────
inputText.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

fileUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        attachedFileData = { name: file.name, type: file.type, data: event.target.result };
        renderFilePreview();
    };
    reader.readAsDataURL(file);
    this.value = ''; 
});

function renderFilePreview() {
    if (!attachedFileData) {
        filePreviewContainer.classList.add('hidden');
        return;
    }
    filePreviewContainer.classList.remove('hidden');
    let icon = attachedFileData.type.startsWith('image/') ? '🖼️' : '📑';
    filePreviewContainer.innerHTML = `
        <div class="file-preview-chip">
            <span class="file-icon">${icon}</span>
            <div style="overflow:hidden;flex:1;padding-right:12px;">
                <p class="file-name">${attachedFileData.name}</p>
                <p class="file-type">${attachedFileData.type.split('/')[1]}</p>
            </div>
            <button onclick="removeAttachment()" class="file-remove" title="Remove">✖</button>
        </div>`;
}

function removeAttachment() { attachedFileData = null; renderFilePreview(); }

function isLikelyURL(str) {
    const pattern = new RegExp('^(https?:\\/\\/)?([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.[a-z]{2,}(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$','i');
    return !!pattern.test(str.trim());
}

// ── PIPELINE EXECUTION ────────────────────────────────────
document.getElementById('verifyBtn').addEventListener('click', async () => {
    const textVal = inputText.value.trim();
    if (!textVal && !attachedFileData) return alert("Please provide input.");

    let inputType = isLikelyURL(textVal) ? "url" : (attachedFileData ? (attachedFileData.type.startsWith('image/') ? "image" : "document") : "text");

    const payload = { type: inputType, text: textVal, file: attachedFileData?.data, filename: attachedFileData?.name };

    document.getElementById('reportContainer').classList.add('hidden');
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('cardsArea').innerHTML = ''; 
    document.getElementById('systemLogs').innerHTML = '';
    document.getElementById('claimTrackerList').innerHTML = '';

    try {
        const response = await fetch('/api/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Backend Error");

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary = buffer.indexOf('\n\n');
            while (boundary !== -1) {
                let chunk = buffer.slice(0, boundary).trim();
                buffer = buffer.slice(boundary + 2);
                if (chunk.startsWith('data: ')) handleStreamData(JSON.parse(chunk.substring(6)));
                boundary = buffer.indexOf('\n\n');
            }
        }
    } catch (e) {
        alert("Pipeline failed. Check server terminal.");
        document.getElementById('loadingState').classList.add('hidden');
    }
});

function handleStreamData(data) {
    const logs = document.getElementById('systemLogs');
    const tracker = document.getElementById('claimTrackerList');

    if (data.step === "system") {
        const logLine = document.createElement('div');
        if (data.message.includes("Triage: Screenshot detected")) {
            logLine.innerHTML = `<span class="log-blue">> OCR: Reading text from your screenshot...</span>`;
        } else if (data.message.includes("Triage: Photograph")) {
            logLine.innerHTML = `<span class="log-purple">> Forensics: ${data.message}</span>`;
        } else if (data.message.includes("Stage") && data.message.includes("↳")) {
            logLine.innerHTML = `<span class="log-cyan">${data.message}</span>`;
        } else if (data.message.includes("3-stage forensic")) {
            logLine.innerHTML = `<span class="log-orange">> ${data.message}</span>`;
        } else {
            logLine.innerText = `> ${data.message}`;
        }
        logs.prepend(logLine);
    } 
    else if (data.step === "claims_extracted") {
        data.claims.forEach((c, i) => {
            const li = document.createElement('li');
            li.innerHTML = `<div class="claim-tracker-item">
                <span><span id="status-icon-${i}">⏳</span> ${c.substring(0, 55)}...</span>
                <span id="status-text-${i}" class="claim-status-badge">Pending</span>
            </div>`;
            tracker.appendChild(li);
        });
    }
    else if (data.step === "researching") {
        document.getElementById(`status-icon-${data.claim_index}`).innerText = "🔍";
        document.getElementById(`status-text-${data.claim_index}`).innerText = "Researching";
    }
    else if (data.step === "judging") {
        document.getElementById(`status-icon-${data.claim_index}`).innerText = "⚖️";
        document.getElementById(`status-text-${data.claim_index}`).innerText = "Judging";
    }
    else if (data.step === "complete") {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('reportContainer').classList.remove('hidden');
        globalResultsData = data.results;

        // Populate Summary
        document.getElementById('statTotal').innerText = data.results.length;
        document.getElementById('statTrue').innerText = data.results.filter(r => r.verdict === 'True').length;
        document.getElementById('statFalse').innerText = data.results.filter(r => r.verdict === 'False').length;
        document.getElementById('statMixed').innerText = data.results.filter(r => r.verdict === 'Partially True' || r.verdict === 'Unverifiable').length;

        if (data.ai_text_detection && data.ai_text_detection.ai_probability_score > 0) {
            document.getElementById('aiDetectionCard').classList.remove('hidden');
            document.getElementById('aiAnalysisText').innerText = data.ai_text_detection.analysis;
            document.getElementById('aiScoreBadge').innerText = `${data.ai_text_detection.ai_probability_score}%`;
        } else {
            document.getElementById('aiDetectionCard').classList.add('hidden');
        }
        
        const mediaCard = document.getElementById('mediaDetectionCard');
        const pipelineBreakdown = document.getElementById('pipelineBreakdown');
        
        if (data.ai_media_detection) {
            mediaCard.classList.remove('hidden');
            document.getElementById('mediaAnalysisText').innerText = data.ai_media_detection.visual_analysis;
            
            // We now show the real score even for screenshots!
            document.getElementById('mediaScoreBadge').innerText = `${data.ai_media_detection.media_ai_score}%`;
            
            const details = data.ai_media_detection.pipeline_details;
            if (details) {
                pipelineBreakdown.classList.remove('hidden');
                const isScreenshot = data.ai_media_detection.image_type === "screenshot";
                
                // Stage 1: Forensic
                const s1 = details.stage1_forensic;
                if (s1) {
                    document.getElementById('scoreForensic').innerText = `${s1.score}/100`;
                    document.getElementById('fillForensic').style.width = `${s1.score}%`;
                    document.getElementById('fillForensic').style.background = getScoreGradient(s1.score);
                    document.getElementById('detailForensic').innerText = s1.summary || 'ELA + FFT + Metadata';
                }
                
                // Stage 2: Hive
                const s2 = details.stage2_hive;
                if (s2) {
                    document.getElementById('scoreHive').innerText = s2.status === 'success' ? `${s2.score}/100` : 'Error';
                    document.getElementById('fillHive').style.width = s2.status === 'success' ? `${s2.score}%` : '0%';
                    document.getElementById('fillHive').style.background = getScoreGradient(s2.score);
                    document.getElementById('detailHive').innerText = s2.status === 'success' 
                        ? `AI prob: ${(s2.ai_prob * 100).toFixed(1)}% | Confidence: ${s2.confidence}`
                        : `Status: ${s2.status}`;
                }
                
                // Stage 3: VLM
                const s3 = details.stage3_vlm;
                if (s3) {
                    const vlmOk = (s3.status === 'success' || s3.status === 'parse_fallback' || s3.status === 'safety_block');
                    document.getElementById('scoreVLM').innerText = vlmOk ? `${s3.score}/100` : 'Error';
                    document.getElementById('fillVLM').style.width = vlmOk ? `${s3.score}%` : '0%';
                    document.getElementById('fillVLM').style.background = getScoreGradient(s3.score);
                    document.getElementById('detailVLM').innerText = s3.anomalies || 'Visual Anomaly Detection';
                }
            } else {
                pipelineBreakdown.classList.add('hidden');
            }
        } else {
            mediaCard.classList.add('hidden');
            pipelineBreakdown.classList.add('hidden');
        }

        // Display Original Input
        const inputDisplay = document.getElementById('originalInputDisplay');
        inputDisplay.innerHTML = '';
        if (attachedFileData && attachedFileData.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = attachedFileData.data;
            img.style.maxWidth = '250px';
            img.style.maxHeight = '250px';
            inputDisplay.appendChild(img);
        }
        const textPara = document.createElement('p');
        textPara.innerText = inputText.value.trim() || (attachedFileData ? `Source File: ${attachedFileData.name}` : "");
        inputDisplay.appendChild(textPara);

        renderResults(data.results);
        removeAttachment();
        inputText.value = "";
    }
}

function getScoreGradient(score) {
    if (score >= 70) return 'linear-gradient(90deg, #ef4444, #dc2626)';
    if (score >= 40) return 'linear-gradient(90deg, #f59e0b, #d97706)';
    return 'linear-gradient(90deg, #22c55e, #16a34a)';
}

function getVerdictClass(verdict) {
    switch (verdict) {
        case 'True': return 'verdict-true';
        case 'False': return 'verdict-false';
        case 'Partially True': return 'verdict-partial';
        default: return 'verdict-unverified';
    }
}

function renderResults(results) {
    const area = document.getElementById('cardsArea');
    results.forEach(r => {
        const card = document.createElement('div');
        card.className = "result-card fade-in";
        card.innerHTML = `
            <div class="result-header">
                <h3 class="result-claim">"${r.claim}"</h3>
                <span class="verdict-badge ${getVerdictClass(r.verdict)}">${r.verdict}</span>
            </div>
            <div class="evidence-box">
                <span class="evidence-label">Evidence Context</span>
                ${r.evidence_context}
            </div>
            <p class="result-analysis"><strong>Analysis:</strong> ${r.reasoning}</p>
            <div class="citations-label">Reference Sources</div>
            ${r.citations.map(u => `<a href="${u}" target="_blank" class="citation-link">${u}</a>`).join('')}
        `;
        area.appendChild(card);
    });
}

// ── CSV Export ─────────────────────────────────────────────
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (globalResultsData.length === 0) return alert("No results to export.");
    
    let csvContent = "data:text/csv;charset=utf-8,Claim,Verdict,Confidence,Reasoning,Sources\n";
    globalResultsData.forEach(r => {
        const row = [
            `"${r.claim.replace(/"/g, '""')}"`,
            r.verdict,
            `${r.confidence_score}%`,
            `"${r.reasoning.replace(/"/g, '""')}"`,
            `"${r.citations.join('; ')}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `FactCheck_Report_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// ── PDF Export (Fixed Layout) ─────────────────────────────
document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const el = document.getElementById('reportContainer');

    // Set timestamp on the baked-in PDF header
    document.getElementById('pdfTimestamp').textContent = new Date().toLocaleString();

    // Temporarily force light theme for clean PDF rendering
    const currentTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme');

    // Add export class that activates all PDF CSS overrides
    document.body.classList.add('pdf-export-mode');

    // Hide interactive elements
    document.querySelectorAll('.hide-on-export').forEach(e => e.style.display = 'none');

    // Small delay to let DOM repaint with light theme
    requestAnimationFrame(() => {
        html2pdf().set({ 
            margin: [0.4, 0.4], 
            filename: 'Forensic_Verification_Report.pdf', 
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, 
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).from(el).save().then(() => {
            // Restore theme and remove export mode
            document.body.classList.remove('pdf-export-mode');
            if (currentTheme) {
                document.documentElement.setAttribute('data-theme', currentTheme);
            }
            document.querySelectorAll('.hide-on-export').forEach(e => e.style.display = '');
        });
    });
});