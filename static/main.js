let globalResultsData = [];
// Array to handle multiple files simultaneously
let attachedFiles = []; 

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

// ── SESSION MANAGEMENT ─────────────────────────────────────────
const STORAGE_KEY = 'factcheckSessions';
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const sessionSidebar = document.getElementById('sessionSidebar');
const sessionsList = document.getElementById('sessionsList');
const newSessionBtn = document.getElementById('newSessionBtn');

let currentSessionId = null;

// Initialize sessions on page load
(function initSessions() {
    renderSessionsList();
    setupSessionEventListeners();
    setTimeout(() => {
        document.getElementById('welcomeScreen').classList.remove('hidden');
    }, 100);
})();

function getSessionsFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// FIX: Added Quota Manager to prevent localStorage crashes when saving images
function saveSessionsToStorage(sessions) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            if (sessions.length > 1) {
                sessions.pop(); // Remove the oldest session to make room
                saveSessionsToStorage(sessions); // Retry saving
            } else {
                console.warn('Browser storage limit reached. Cannot save image.');
            }
        }
    }
}

// Generate a short, crisp title for the sidebar
function generateShortTitle(rawText) {
    if (!rawText) return "New Verification";
    
    let cleanText = rawText.replace(/https?:\/\/[^\s]+/g, '').trim();
    if (!cleanText) return "URL Analysis"; 
    
    let words = cleanText.split(/\s+/);
    let title = words.slice(0, 5).join(' ');
    
    title = title.replace(/[,.-]+$/, "");
    if (words.length > 5) title += '...';
    
    return title.charAt(0).toUpperCase() + title.slice(1);
}

function createSession(rawInput, inputType) {
    const sessions = getSessionsFromStorage();
    const session = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        inputText: generateShortTitle(rawInput),
        inputType: inputType,
        icon: getSessionIcon(inputType),
        sessionData: null 
    };
    sessions.unshift(session);
    saveSessionsToStorage(sessions);
    currentSessionId = session.id;
    return session;
}

function getSessionIcon(inputType) {
    const icons = { 'text': '💬', 'url': '🔗', 'document': '📄', 'image': '🖼️' };
    return icons[inputType] || '📌';
}

function saveSessionResults(sessionId, sessionData) {
    const sessions = getSessionsFromStorage();
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
        session.sessionData = sessionData;
        saveSessionsToStorage(sessions);
    }
}

// Close dropdowns when clicking anywhere else on the document
document.addEventListener('click', () => {
    document.querySelectorAll('.session-dropdown').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.session-item-menu').forEach(m => m.classList.remove('active'));
});

function renderSessionsList() {
    const sessions = getSessionsFromStorage();
    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
        sessionsList.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:0.85rem;">No sessions yet</p>';
        return;
    }

    sessions.forEach(session => {
        const sessionEl = document.createElement('div');
        sessionEl.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
        sessionEl.setAttribute('data-session-id', session.id);

        const time = new Date(session.timestamp).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        sessionEl.innerHTML = `
            <div class="session-icon">${session.icon}</div>
            <div class="session-text">
                <span class="session-title">${session.inputText}</span>
                <span class="session-time">${time}</span>
            </div>
            <div class="session-item-menu">
                <button class="session-options-btn" title="Options">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="5" r="1.5"></circle>
                        <circle cx="12" cy="12" r="1.5"></circle>
                        <circle cx="12" cy="19" r="1.5"></circle>
                    </svg>
                </button>
                <div class="session-dropdown hidden">
                    <button class="rename-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        Rename
                    </button>
                    <button class="delete-btn">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Delete
                    </button>
                </div>
            </div>
        `;

        sessionEl.addEventListener('click', (e) => {
            if (!e.target.closest('.session-item-menu')) {
                loadSession(session.id);
            }
        });

        const optionsBtn = sessionEl.querySelector('.session-options-btn');
        const dropdown = sessionEl.querySelector('.session-dropdown');
        const menuContainer = sessionEl.querySelector('.session-item-menu');

        optionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.session-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });
            document.querySelectorAll('.session-item-menu').forEach(m => {
                if (m !== menuContainer) m.classList.remove('active');
            });
            dropdown.classList.toggle('hidden');
            menuContainer.classList.toggle('active');
        });

        sessionEl.querySelector('.rename-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.add('hidden');
            menuContainer.classList.remove('active');
            renameSession(session.id);
        });

        sessionEl.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSession(session.id);
        });

        sessionsList.appendChild(sessionEl);
    });
}

function renameSession(sessionId) {
    const sessions = getSessionsFromStorage();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const newTitle = prompt("Enter a new name for this session:", session.inputText);
    if (newTitle !== null && newTitle.trim() !== "") {
        session.inputText = newTitle.trim();
        saveSessionsToStorage(sessions);
        renderSessionsList();
    }
}

function loadSession(sessionId) {
    const sessions = getSessionsFromStorage();
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const dataToLoad = session.sessionData || {
        results: session.results || [],
        ai_text_detection: null,
        ai_media_detection: null,
        originalInput: session.inputText || "Legacy Session",
        images: []
    };

    currentSessionId = sessionId;
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-session-id="${sessionId}"]`).classList.add('active');

    globalResultsData = dataToLoad.results;
    
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('reportContainer').classList.remove('hidden');
    
    populateReportUI(dataToLoad);
    closeSidebar();
}

function deleteSession(sessionId) {
    if (!confirm('Delete this session?')) return;
    const sessions = getSessionsFromStorage();
    const filtered = sessions.filter(s => s.id !== sessionId);
    saveSessionsToStorage(filtered);
    if (currentSessionId === sessionId) createNewSession();
    else renderSessionsList();
}

function setupSessionEventListeners() {
    sidebarToggleBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    newSessionBtn.addEventListener('click', createNewSession);
}

function openSidebar() {
    sessionSidebar.classList.add('visible');
    document.body.classList.add('sidebar-open');
}

function closeSidebar() {
    sessionSidebar.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
}

function createNewSession() {
    currentSessionId = null;
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    document.getElementById('reportContainer').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('hidden');
    inputText.value = '';
    removeAttachment();
    closeSidebar();
}

// ── OMNI-INPUT UX ─────────────────────────────────────────
function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

inputText.addEventListener('input', function() {
    autoResizeTextarea(this);
});

inputText.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('verifyBtn').click();
    }
});

// ── MULTI-FILE ATTACHMENT LOGIC ─────────────────────────────
const attachMenuBtn = document.getElementById('attachMenuBtn');
const attachmentMenu = document.getElementById('attachmentMenu');

function initAttachmentMenu() {
    if (attachMenuBtn) {
        attachMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            attachmentMenu.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.attachment-menu-wrapper')) {
            attachmentMenu.classList.add('hidden');
        }
    });

    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const category = item.getAttribute('data-category');
            const fileInputMap = { 'documents': 'fileUploadDocuments', 'images': 'fileUploadImages', 'audio': 'fileUploadAudio', 'all': 'fileUploadAll' };
            
            // FIX: Added the missing line to actually find the input element by its ID
            const fileInput = document.getElementById(fileInputMap[category]); 
            
            if (fileInput) fileInput.click();
            attachmentMenu.classList.add('hidden');
        });
    });
}

['Documents', 'Images', 'Audio', 'All'].forEach(category => {
    const input = document.getElementById(`fileUpload${category}`);
    if (input) input.addEventListener('change', handleFileUpload);
});

initAttachmentMenu();

function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            attachedFiles.push({ name: file.name, type: file.type, data: event.target.result });
            renderFilePreview();
        };
        reader.readAsDataURL(file);
    });
    this.value = '';
}

function renderFilePreview() {
    filePreviewContainer.innerHTML = '';
    if (attachedFiles.length === 0) {
        filePreviewContainer.classList.add('hidden');
        return;
    }
    filePreviewContainer.classList.remove('hidden');
    
    attachedFiles.forEach((file, index) => {
        let icon = file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('audio/') ? '🎵' : '📄';
        filePreviewContainer.innerHTML += `
            <div class="file-preview-chip clickable" onclick="if(event.target.tagName !== 'BUTTON') openDocModal('${file.name}', attachedFiles[${index}].data)">                <span class="file-icon">${icon}</span>
                <div style="overflow:hidden;flex:1;padding-right:12px;">
                    <p class="file-name">${file.name}</p>
                    <p class="file-type">${file.type.split('/')[1] || 'FILE'}</p>
                </div>
                <button onclick="removeAttachment(${index})" class="file-remove" title="Remove">✖</button>
            </div>`;
    });
}

// Expose removeAttachment globally
window.removeAttachment = function(index) { 
    if (index === undefined) {
        attachedFiles = []; 
    } else {
        attachedFiles.splice(index, 1); 
    }
    renderFilePreview(); 
}

function isLikelyURL(str) {
    const pattern = new RegExp('^(https?:\\/\\/)?([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.[a-z]{2,}(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$','i');
    return !!pattern.test(str.trim());
}

// ── PIPELINE EXECUTION ────────────────────────────────────
document.getElementById('verifyBtn').addEventListener('click', async () => {
    const textVal = inputText.value.trim();
    if (!textVal && attachedFiles.length === 0) return alert("Please provide input or upload files.");

    let inputType = isLikelyURL(textVal) ? "url" : (attachedFiles.length > 0 ? (attachedFiles[0].type.startsWith('image/') ? "image" : attachedFiles[0].type.startsWith('audio/') ? "audio" : "document") : "text");
    const payload = { type: inputType, text: textVal, files: attachedFiles };

    document.getElementById('welcomeScreen').classList.add('hidden');
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
        if (data.message.includes("Triage: OCR Text detected")) logLine.innerHTML = `<span class="log-blue">> ${data.message}</span>`;
        else if (data.message.includes("Stage") && data.message.includes("↳")) logLine.innerHTML = `<span class="log-cyan">${data.message}</span>`;
        else if (data.message.includes("3-stage forensic")) logLine.innerHTML = `<span class="log-orange">> ${data.message}</span>`;
        else logLine.innerText = `> ${data.message}`;
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
        document.getElementById('welcomeScreen').classList.add('hidden');
        document.getElementById('reportContainer').classList.remove('hidden');
        globalResultsData = data.results;

        let sessionTitle = inputText.value.trim();
        if (!sessionTitle && attachedFiles.length > 0) {
            sessionTitle = attachedFiles.map(f => f.name).join(', ');
        }

        if (currentSessionId === null) {
            const inputTypeVal = isLikelyURL(inputText.value.trim()) ? "url" :
                                (attachedFiles.length > 0 ? (attachedFiles[0].type.startsWith('image/') ? "image" : "document") : "text");
            const newSession = createSession(sessionTitle || "Verification", inputTypeVal);
            currentSessionId = newSession.id;
        }

        // FIX: Extract both Images AND Documents to save into Session History
        const savedImages = attachedFiles.filter(f => f.type.startsWith('image/')).map(f => f.data);
        const savedDocs = attachedFiles.filter(f => !f.type.startsWith('image/')).map(f => ({ name: f.name, type: f.type, data: f.data }));
        
        const sessionData = {
            results: data.results,
            ai_text_detection: data.ai_text_detection,
            ai_media_detection: data.ai_media_detection,
            originalInput: sessionTitle,
            images: savedImages, 
            documents: savedDocs // Added documents storage
        };
        
        saveSessionResults(currentSessionId, sessionData);
        renderSessionsList();
        populateReportUI(sessionData);

        removeAttachment();
        inputText.value = "";
    }

    else if (data.step === "error") {
        const logLine = document.createElement('div');
        logLine.innerHTML = `<span style="color: #ef4444; font-weight: bold;">> [ERROR] ${data.message}</span>`;
        document.getElementById('systemLogs').prepend(logLine);
        
        // Hide the loading state and bring back the welcome screen
        setTimeout(() => {
            document.getElementById('loadingState').classList.add('hidden');
            document.getElementById('welcomeScreen').classList.remove('hidden');
            
            // Alert the user
            alert(`Analysis Stopped: ${data.message}\n\nPlease enter a factual claim, news snippet, or upload a document instead of conversational text.`);
        }, 500); // 500ms delay so they can read the red error in the terminal
    }
}

function populateReportUI(data) {
    window.currentLiveDocs = {}; 
    
    // 1. Update Core Stats
    document.getElementById('statTotal').innerText = data.results.length;
    document.getElementById('statTrue').innerText = data.results.filter(r => r.verdict === 'True').length;
    document.getElementById('statFalse').innerText = data.results.filter(r => r.verdict === 'False').length;
    document.getElementById('statMixed').innerText = data.results.filter(r => r.verdict === 'Partially True' || r.verdict === 'Unverifiable').length;

    // 2. Handle AI Text Detection Card
    const aiTextCard = document.getElementById('aiDetectionCard');
    if (data.ai_text_detection && data.ai_text_detection.ai_probability_score > 0) {
        aiTextCard.classList.remove('hidden');
        document.getElementById('aiAnalysisText').innerText = data.ai_text_detection.analysis;
        document.getElementById('aiScoreBadge').innerText = `${data.ai_text_detection.ai_probability_score}%`;
    } else {
        aiTextCard.classList.add('hidden');
    }
    
    // 3. Clear and Rebuild Deepfake Media Cards
    const detectionRow = document.querySelector('.detection-row');
    // Delete only the cards with class 'deepfake' to keep the 'ai-text' card intact
    document.querySelectorAll('.detection-card.deepfake').forEach(el => el.remove());

    if (data.ai_media_detection && Array.isArray(data.ai_media_detection)) {
        data.ai_media_detection.forEach((media) => {
            const isAudio = media.media_type === "audio";
            const title = isAudio ? "Voice Deepfake Analysis" : "Deepfake Forensic Analysis";
            const fileTag = media.filename ? `<div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 8px; font-weight: 600;">File: ${media.filename}</div>` : '';
            
            let pipelineHTML = '';
            if (media.pipeline_details) {
                // Map stages based on file type
                const s1 = isAudio ? media.pipeline_details.stage1_acoustic : media.pipeline_details.stage1_forensic;
                const s2 = media.pipeline_details.stage2_hf || media.pipeline_details.stage2_hive;
                const s3 = media.pipeline_details.stage3_synthesis || media.pipeline_details.stage3_vlm;

                pipelineHTML = `
                <div class="pipeline-breakdown">
                    <button class="pipeline-toggle-btn" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron-icon').classList.toggle('rotate-180');">
                        <span class="pipeline-heading">Pipeline Breakdown</span>
                        <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div class="pipeline-stages hidden">
                        ${s1 ? `<div class="pipeline-stage"><div class="stage-header"><span class="stage-name">${isAudio ? 'Acoustics' : 'Forensics'}</span><span class="stage-score">${s1.score}/100</span></div><div class="stage-bar"><div class="stage-fill" style="width:${s1.score}%; background:${getScoreGradient(s1.score)};"></div></div></div>` : ''}
                        ${s2 ? `<div class="pipeline-stage"><div class="stage-header"><span class="stage-name">${isAudio ? 'Voice Model' : 'HF Inference'}</span><span class="stage-score">${s2.score}/100</span></div><div class="stage-bar"><div class="stage-fill" style="width:${s2.score}%; background:${getScoreGradient(s2.score)};"></div></div></div>` : ''}
                        ${s3 ? `<div class="pipeline-stage"><div class="stage-header"><span class="stage-name">Decision Layer</span><span class="stage-score">${s3.score}/100</span></div><div class="stage-bar"><div class="stage-fill" style="width:${s3.score}%; background:${getScoreGradient(s3.score)};"></div></div></div>` : ''}
                    </div>
                </div>`;
            }

            const mediaCardHTML = `
            <div class="detection-card deepfake">
                <div class="detection-info">
                    <h3 class="detection-title">${title}</h3>
                    ${fileTag}
                    <p class="detection-text">${media.visual_analysis || "No anomalies detected."}</p>
                </div>
                <span class="score-badge">${media.media_ai_score}%</span>
                ${pipelineHTML}
            </div>`;
            detectionRow.insertAdjacentHTML('beforeend', mediaCardHTML);
        });
    }

    // 4. Update Original Source Display
    const inputDisplay = document.getElementById('originalInputDisplay');
    inputDisplay.innerHTML = '';
    const mediaContainer = document.createElement('div');

    if (data.images) data.images.forEach(imgData => {
        const img = document.createElement('img');
        img.src = imgData;
        img.style.maxWidth = '200px'; img.style.borderRadius = '8px'; img.style.margin = '0 10px 10px 0';
        mediaContainer.appendChild(img);
    });

    if (data.documents) data.documents.forEach(doc => {
        window.currentLiveDocs[doc.name] = doc.data;
        const docCard = document.createElement('div');
        docCard.className = 'doc-preview-chip clickable';
        docCard.setAttribute('onclick', `openDocModal('${doc.name}')`);
        docCard.innerHTML = `<span style="margin-right:8px;">📄</span>${doc.name}`;
        mediaContainer.appendChild(docCard);
    });

    inputDisplay.appendChild(mediaContainer);
    const textPara = document.createElement('p');
    textPara.innerText = data.originalInput;
    inputDisplay.appendChild(textPara);
    
    renderResults(data.results);
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
    area.innerHTML = ''; 
    results.forEach(r => {
        const card = document.createElement('div');
        card.className = "result-card fade-in";
        
        const citationsHtml = (r.citations && r.citations.length > 0) 
            ? `<div class="citations-label">Reference Sources</div>
               ${r.citations.map(u => `<a href="${u}" target="_blank" class="citation-link">${u}</a>`).join('')}`
            : ``; 

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
            ${citationsHtml}
        `;
        area.appendChild(card);
    });
}

// ── EXPORT FUNCTIONS ─────────────────────────────────────────────
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    if (globalResultsData.length === 0) return alert("No results to export.");
    let csvContent = "data:text/csv;charset=utf-8,Claim,Verdict,Confidence,Reasoning,Sources\n";
    globalResultsData.forEach(r => {
        const row = [ `"${r.claim.replace(/"/g, '""')}"`, r.verdict, `${r.confidence_score}%`, `"${r.reasoning.replace(/"/g, '""')}"`, `"${r.citations.join('; ')}"` ].join(",");
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

document.getElementById('exportPdfBtn').addEventListener('click', () => {
    if (globalResultsData.length === 0) return alert("No results to export.");

    const now       = new Date();
    const reportId  = 'FCR-' + now.getFullYear()
                    + String(now.getMonth()+1).padStart(2,'0')
                    + String(now.getDate()).padStart(2,'0')
                    + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
    const dateStr   = now.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
    const timeStr   = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
    const total     = globalResultsData.length;
    const trueCount = globalResultsData.filter(r => r.verdict === 'True').length;
    const falseCount= globalResultsData.filter(r => r.verdict === 'False').length;
    const mixedCount= globalResultsData.filter(r => r.verdict === 'Partially True' || r.verdict === 'Unverifiable').length;
    const credScore = total > 0 ? Math.round((trueCount / total) * 100) : 0;
    
    const srcEl     = document.getElementById('originalInputDisplay');
    const sourceTextPara = srcEl ? srcEl.querySelector('p') : null;
    const sourceText = sourceTextPara ? sourceTextPara.innerText.trim().substring(0, 500) : '';

    let pdfMediaHtml = '';
    if (srcEl) {
        const imgs = srcEl.querySelectorAll('img');
        imgs.forEach(img => {
            pdfMediaHtml += `<img src="${img.src}" style="max-height:200px; max-width:100%; border-radius:10px; margin: 0 12px 12px 0; border:1px solid #1e2d42;">`;
        });

        const docs = srcEl.querySelectorAll('.doc-preview-card');
        docs.forEach(doc => {
            const name = doc.querySelector('.doc-preview-name').innerText;
            pdfMediaHtml += `
            <div style="display:inline-block; background:#1a1f35; border:1px solid #2d3561; border-radius:8px; padding:12px 16px; margin: 0 12px 12px 0; vertical-align:top;">
                <span style="font-size:24px; vertical-align:middle; margin-right:8px;">📄</span>
                <span style="font-size:14px; color:#e8edf5; font-weight:700; font-family:sans-serif;">${name}</span>
            </div>`;
        });
    }

    // Process deepfake results
    const mediaArray = Array.isArray(globalResultsData.ai_media_detection) ? globalResultsData.ai_media_detection : (globalResultsData.ai_media_detection ? [globalResultsData.ai_media_detection] : []);
    let mediaBoxesHTML = '';
    
    // We fetch from the live DOM to ensure we get the latest LLM reasoning strings
    const deepfakeCards = document.querySelectorAll('.detection-card.deepfake');
    deepfakeCards.forEach(card => {
        const score = card.querySelector('.score-badge').innerText;
        const text = card.querySelector('.detection-text').innerText;
        const title = card.querySelector('.detection-title').innerText;
        const fileTagEl = card.querySelector('.detection-info div[style*="font-size: 0.75rem"]');
        const fileTag = fileTagEl ? ` - ${fileTagEl.innerText}` : '';

        mediaBoxesHTML += `
        <div style="background:#0f1623; border:1px solid #1e2d42; border-top:4px solid #c084fc; border-radius:10px; padding:20px; margin-bottom:20px; page-break-inside: avoid;">
            <div style="font-size:12px; font-weight:700; color:#c084fc; text-transform:uppercase; margin-bottom:10px;">${title}${fileTag}</div>
            <div style="font-size:32px; font-weight:900; color:#c084fc; font-family:monospace; margin-bottom:8px;">${score}</div>
            <div style="font-size:14px; color:#a8b4c8; line-height:1.6;">${text}</div>
        </div>`;
    });

    function vc(v) {
        if (v === 'True')           return { border:'#16a34a', text:'#4ade80', bg:'#0d2b1a', label:'VERIFIED TRUE' };
        if (v === 'False')          return { border:'#dc2626', text:'#f87171', bg:'#2b0d0d', label:'DEBUNKED FALSE' };
        if (v === 'Partially True') return { border:'#d97706', text:'#fbbf24', bg:'#2b1f0d', label:'PARTIALLY TRUE' };
        return                             { border:'#475569', text:'#94a3b8', bg:'#1a1f2b', label:'UNVERIFIABLE' };
    }

    const credColor = credScore >= 80 ? '#4ade80' : credScore >= 50 ? '#fbbf24' : '#f87171';
    const credLabel = credScore >= 80 ? 'HIGH CREDIBILITY' : credScore >= 50 ? 'MODERATE CREDIBILITY' : 'LOW CREDIBILITY';

    let claimsHTML = '';
    globalResultsData.forEach((r, i) => {
        const v = vc(r.verdict);
        const srcs = (r.citations || []).slice(0, 3).map(u => 
            `<div style="font-size:12px; color:#60a5fa; margin-top:5px; word-break:break-all;">${u}</div>`
        ).join('');
        
        claimsHTML += `
            <div style="page-break-inside: avoid; background:#0f1623; border:1px solid #1e2d42; border-left:5px solid ${v.border}; border-radius:10px; padding:24px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <span style="font-size:14px; color:#6b7a90; font-weight:700; text-transform:uppercase;">Claim #${i+1}</span>
                    <span style="background:${v.bg}; border:1px solid ${v.border}; color:${v.text}; font-size:12px; font-weight:800; padding:4px 14px; border-radius:20px;">${v.label}</span>
                </div>
                <div style="font-size:18px; font-weight:700; color:#e8edf5; line-height:1.4; margin-bottom:15px;">"${r.claim}"</div>
                <div style="background:#080c14; border-left:3px solid #6366f1; padding:15px; border-radius:0 6px 6px 0; margin-bottom:15px;">
                    <div style="font-size:11px; font-weight:700; color:#4a5568; text-transform:uppercase; margin-bottom:5px;">Evidence Context</div>
                    <div style="font-size:14px; color:#a8b4c8; font-style:italic;">${r.evidence_context || 'N/A'}</div>
                </div>
                <div style="font-size:15px; color:#a8b4c8; line-height:1.6; margin-bottom:15px;">${r.reasoning}</div>
                ${srcs ? `<div style="border-top:1px solid #1e2d42; padding-top:12px;"><div style="font-size:11px; font-weight:700; color:#4a5568; text-transform:uppercase; margin-bottom:6px;">Sources</div>${srcs}</div>` : ''}
            </div>`;
    });

    const htmlString = `
    <div style="background:#080c14; color:#e8edf5; font-family:Arial, sans-serif; padding:50px; width:1000px; margin:0 auto;">
        <div style="border-bottom:2px solid #1e2d42; padding-bottom:30px; margin-bottom:40px; display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
                <div style="background:#1a1f35; border:1px solid #2d3561; border-radius:20px; display:inline-block; padding:6px 16px; margin-bottom:20px;">
                    <span style="font-size:12px; font-weight:700; color:#818cf8; text-transform:uppercase; letter-spacing:0.1em;">AI FORENSIC ENGINE &middot; VERIFIED</span>
                </div>
                <div style="font-size:38px; font-weight:900; color:#f0f4ff; line-height:1.1; margin-bottom:10px;">Forensic Verification Report</div>
                <div style="font-size:15px; color:#6b7a90;">Automated Multi-Agent Intelligence Extraction</div>
            </div>
            <div style="background:#0f1623; border:1px solid #1e2d42; border-radius:10px; padding:20px; min-width:220px;">
                <div style="font-size:11px; color:#4a5568; text-transform:uppercase; margin-bottom:5px;">Report ID</div>
                <div style="font-size:15px; font-weight:700; color:#818cf8; font-family:monospace; margin-bottom:15px;">${reportId}</div>
                <div style="font-size:11px; color:#4a5568; text-transform:uppercase; margin-bottom:5px;">Timestamp</div>
                <div style="font-size:13px; font-weight:600; color:#a8b4c8;">${dateStr}</div>
                <div style="font-size:12px; color:#6b7a90;">${timeStr}</div>
            </div>
        </div>

        <div style="background:#0f1623; border:1px solid #1e2d42; border-radius:15px; padding:35px; margin-bottom:40px; display:flex; gap:40px; align-items:center; page-break-inside: avoid;">
            <div style="text-align:center; min-width:250px; border-right:1px solid #1e2d42; padding-right:40px;">
                <div style="font-size:13px; font-weight:700; color:#4a5568; text-transform:uppercase; margin-bottom:10px;">Credibility Score</div>
                <div style="font-size:82px; font-weight:900; color:${credColor}; font-family:monospace; line-height:1;">${credScore}%</div>
                <div style="font-size:14px; font-weight:800; color:${credColor}; text-transform:uppercase; margin-top:10px; letter-spacing:0.05em;">${credLabel}</div>
            </div>
            <div style="flex:1;">
                <div style="display:flex; gap:15px; margin-top:10px;">
                    <div style="flex:1; background:#080c14; border:1px solid #1e2d42; border-radius:10px; padding:15px; text-align:center;">
                        <div style="font-size:32px; font-weight:900; color:#4ade80; font-family:monospace;">${trueCount}</div>
                        <div style="font-size:11px; color:#4a5568; text-transform:uppercase;">True</div>
                    </div>
                    <div style="flex:1; background:#080c14; border:1px solid #1e2d42; border-radius:10px; padding:15px; text-align:center;">
                        <div style="font-size:32px; font-weight:900; color:#f87171; font-family:monospace;">${falseCount}</div>
                        <div style="font-size:11px; color:#4a5568; text-transform:uppercase;">False</div>
                    </div>
                    <div style="flex:1; background:#080c14; border:1px solid #1e2d42; border-radius:10px; padding:15px; text-align:center;">
                        <div style="font-size:32px; font-weight:900; color:#fbbf24; font-family:monospace;">${mixedCount}</div>
                        <div style="font-size:11px; color:#4a5568; text-transform:uppercase;">Mixed</div>
                    </div>
                </div>
            </div>
        </div>

        <div style="background:#0f1623; border:1px solid #1e2d42; border-left:6px solid #6366f1; border-radius:0 12px 12px 0; padding:25px; margin-bottom:40px; page-break-inside: avoid;">
            <div style="font-size:12px; font-weight:700; color:#4a5568; text-transform:uppercase; margin-bottom:15px;">Original Data Analyzed</div>
            <div style="margin-bottom:20px;">${pdfMediaHtml}</div>
            <div style="font-size:16px; color:#a8b4c8; line-height:1.7; font-style:italic;">${sourceText}...</div>
        </div>

        <div style="margin-bottom:40px;">
            <div style="font-size:16px; font-weight:800; color:#e8edf5; text-transform:uppercase; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid #1e2d42;">Forensic Detection Suite</div>
            <div style="display:flex; gap:25px; align-items:flex-start;">
                ${showAI ? `
                <div style="flex:1; background:#0f1623; border:1px solid #1e2d42; border-top:4px solid #60a5fa; border-radius:10px; padding:20px;">
                    <div style="font-size:12px; font-weight:700; color:#60a5fa; text-transform:uppercase; margin-bottom:10px;">AI Content Analysis</div>
                    <div style="font-size:32px; font-weight:900; color:#60a5fa; font-family:monospace; margin-bottom:8px;">${aiScore}</div>
                    <div style="font-size:14px; color:#6b7a90; line-height:1.6;">${aiText}</div>
                </div>` : ''}
                <div style="flex:1;">${mediaBoxesHTML}</div>
            </div>
        </div>

        <div style="font-size:16px; font-weight:800; color:#e8edf5; text-transform:uppercase; margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid #1e2d42;">
            Atomic Claim Breakdown
        </div>
        ${claimsHTML}
        
        <div style="margin-top:50px; text-align:center; border-top:1px solid #1e2d42; padding-top:20px; font-size:12px; color:#4a5568;">
            This report is AI-generated for forensic purposes. Internal ID: ${reportId}
        </div>
    </div>`;

    const opt = {
        margin:       [0, 0],
        filename:     `Forensic_Report_${reportId}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#080c14',
            width: 1000, // Force the canvas to the expected width
            windowWidth: 1000
        },
        jsPDF:        { unit: 'px', format: [1000, 1414], hotfixes: ['px_scaling'] } // Use custom size based on A4 ratio
    };

    html2pdf().from(htmlString).set(opt).save();
});

// ── DOCUMENT MODAL LOGIC ───────────────────────────────────────
window.openDocModal = function(title) {
    const dataUrl = window.currentLiveDocs ? window.currentLiveDocs[title] : null;
    if (!dataUrl) return alert("Document data not available in this session.");
    
    document.getElementById('docModalTitle').innerText = title;
    
    // FIX 3: Chrome blocks direct base64 PDF rendering in iframes. Convert to a safe Blob URL.
    if (dataUrl.startsWith('data:application/pdf')) {
        fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                document.getElementById('docModalFrame').src = blobUrl;
            })
            .catch(err => alert("Error loading PDF preview."));
    } else {
        document.getElementById('docModalFrame').src = dataUrl;
    }
    
    document.getElementById('docModal').classList.remove('hidden');
};

document.getElementById('closeDocModal')?.addEventListener('click', () => {
    document.getElementById('docModal').classList.add('hidden');
    document.getElementById('docModalFrame').src = ''; // Clear iframe memory
});

document.getElementById('docModal')?.addEventListener('click', (e) => {
    if(e.target.id === 'docModal') {
        document.getElementById('docModal').classList.add('hidden');
        document.getElementById('docModalFrame').src = '';
    }
});

// ── INTERACTIVE HTML EXPORT (STANDALONE OFFLINE REPORT) ──
document.getElementById('exportHtmlBtn')?.addEventListener('click', () => {
    if (globalResultsData.length === 0) return alert("No results to export.");

    const now = new Date();
    const reportId = 'FCR-' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
    
    const reportClone = document.getElementById('reportContainer').cloneNode(true);
    
    const exportActions = reportClone.querySelector('.export-actions');
    if(exportActions) exportActions.remove();

    let cssStyles = '';
    for (let sheet of document.styleSheets) {
        try {
            for (let rule of sheet.cssRules) {
                cssStyles += rule.cssText + '\n';
            }
        } catch(e) { }
    }

    const modalHtml = `
    <div id="docModal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="docModalTitle" class="modal-title">Document Preview</h3>
                <button id="closeDocModal" class="btn-icon" title="Close Preview" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;">✖</button>
            </div>
            <div class="modal-body">
                <iframe id="docModalFrame" src=""></iframe>
            </div>
        </div>
    </div>`;

    // FIX 4: Extract all Base64 documents from the live session to inject into the offline file
    let docsScript = "window.exportedDocs = {};\n";
    if (window.currentLiveDocs) {
        for (const [name, data] of Object.entries(window.currentLiveDocs)) {
            docsScript += `window.exportedDocs["${name}"] = "${data}";\n`;
        }
    }

    const interactiveJs = `
        <script>
            document.documentElement.setAttribute('data-theme', 'dark');

            // Inject the extracted Base64 data
            ${docsScript}

            window.openDocModal = function(title) {
                const dataUrl = window.exportedDocs[title];
                if (!dataUrl) return alert("Document data not available.");
                
                document.getElementById('docModalTitle').innerText = title;
                
                // Blob conversion for offline iframe loading
                if (dataUrl.startsWith('data:application/pdf')) {
                    fetch(dataUrl)
                        .then(res => res.blob())
                        .then(blob => {
                            const blobUrl = URL.createObjectURL(blob);
                            document.getElementById('docModalFrame').src = blobUrl;
                        });
                } else {
                    document.getElementById('docModalFrame').src = dataUrl;
                }
                
                document.getElementById('docModal').classList.remove('hidden');
            };

            document.getElementById('closeDocModal').addEventListener('click', () => {
                document.getElementById('docModal').classList.add('hidden');
                document.getElementById('docModalFrame').src = ''; 
            });

            document.getElementById('docModal').addEventListener('click', (e) => {
                if(e.target.id === 'docModal') {
                    document.getElementById('docModal').classList.add('hidden');
                    document.getElementById('docModalFrame').src = '';
                }
            });

            const toggleBtn = document.getElementById('togglePipelineBtn');
            if(toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    document.getElementById('pipelineContent').classList.toggle('hidden');
                    document.getElementById('pipelineChevron').classList.toggle('rotate-180');
                });
            }
        </script>
    `;

    const finalHtml = `
    <!DOCTYPE html>
    <html lang="en" data-theme="dark">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Interactive Forensic Report - ${reportId}</title>
        <style>
            ${cssStyles}
            body { padding: 40px; background: var(--bg-main); }
            #reportContainer { max-width: 900px; margin: 0 auto; display: block !important; }
        </style>
    </head>
    <body>
        ${reportClone.outerHTML}
        ${modalHtml}
        ${interactiveJs}
    </body>
    </html>`;

    const blob = new Blob([finalHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Interactive_Report_${reportId}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});