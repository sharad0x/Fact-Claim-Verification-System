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
            const fileInputMap = { 'documents': 'fileUploadDocuments', 'images': 'fileUploadImages', 'all': 'fileUploadAll' };
            const fileInput = document.getElementById(fileInputMap[category]);
            if (fileInput) fileInput.click();
            attachmentMenu.classList.add('hidden');
        });
    });
}

['Documents', 'Images', 'All'].forEach(category => {
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
        let icon = file.type.startsWith('image/') ? '🖼️' : '📄';
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

    let inputType = isLikelyURL(textVal) ? "url" : (attachedFiles.length > 0 ? (attachedFiles[0].type.startsWith('image/') ? "image" : "document") : "text");
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

// ── REUSABLE UI POPULATOR ──
function populateReportUI(data) {
    window.currentLiveDocs = {}; // Reset global doc store for modals
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
        
        // FIX: Removed the 'isScreenshot' bypass completely so the score ALWAYS displays!
        document.getElementById('mediaScoreBadge').innerText = `${data.ai_media_detection.media_ai_score}%`;
        
        const details = data.ai_media_detection.pipeline_details;
        if (details) {
            pipelineBreakdown.classList.remove('hidden');
            
            const s1 = details.stage1_forensic;
            if (s1) {
                document.getElementById('scoreForensic').innerText = `${s1.score}/100`;
                document.getElementById('fillForensic').style.width = `${s1.score}%`;
                document.getElementById('fillForensic').style.background = getScoreGradient(s1.score);
                document.getElementById('detailForensic').innerText = s1.summary || 'ELA + FFT + Metadata';
            }
            
            const s2 = details.stage2_hive;
            if (s2) {
                document.getElementById('scoreHive').innerText = s2.status === 'success' ? `${s2.score}/100` : 'Error';
                document.getElementById('fillHive').style.width = s2.status === 'success' ? `${s2.score}%` : '0%';
                document.getElementById('fillHive').style.background = getScoreGradient(s2.score);
                document.getElementById('detailHive').innerText = s2.status === 'success' 
                    ? `AI prob: ${(s2.ai_prob * 100).toFixed(1)}% | Confidence: ${s2.confidence}`
                    : `Status: ${s2.status}`;
            }
            
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

    const inputDisplay = document.getElementById('originalInputDisplay');
    inputDisplay.innerHTML = '';

    const mediaContainer = document.createElement('div');

    if (data.images && data.images.length > 0) {
        data.images.forEach(imgData => {
            const img = document.createElement('img');
            img.src = imgData;
            img.style.maxWidth = '250px';
            img.style.maxHeight = '250px';
            img.style.marginRight = '12px';
            img.style.marginBottom = '12px';
            img.style.display = 'inline-block';
            img.style.borderRadius = '8px';
            img.style.border = '1px solid var(--border)';
            mediaContainer.appendChild(img);
        });
    }

    // Update the docCard creation block to look exactly like this:
    if (data.documents && data.documents.length > 0) {
        data.documents.forEach(doc => {
            // Save the huge base64 string to a global dictionary instead of inline HTML
            window.currentLiveDocs[doc.name] = doc.data;
            
            const docCard = document.createElement('div');
            docCard.className = 'doc-preview-card clickable';
            
            // FIX 2: Use setAttribute so the click handler survives cloneNode(true) during HTML Export
            docCard.setAttribute('onclick', `openDocModal('${doc.name}')`);
            
            docCard.innerHTML = `
                <div class="doc-preview-icon">📄</div>
                <div class="doc-preview-info">
                    <div class="doc-preview-name">${doc.name}</div>
                    <div class="doc-preview-type">${doc.type ? doc.type.split('/')[1] || 'Document' : 'Document'}</div>
                </div>
            `;
            mediaContainer.appendChild(docCard);
        });
    }

    if (mediaContainer.childNodes.length > 0) {
        inputDisplay.appendChild(mediaContainer);
    }

    const textPara = document.createElement('p');
    // Prevent duplicating filenames in text if no custom prompt was typed
    if (!data.documents || data.documents.length === 0 || data.originalInput !== data.documents.map(d=>d.name).join(', ')) {
        textPara.innerText = data.originalInput;
        inputDisplay.appendChild(textPara);
    }
    
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
    // Extract paragraph text but safely ignore the visual cards
    const sourceTextPara = srcEl ? srcEl.querySelector('p') : null;
    const sourceText = sourceTextPara ? sourceTextPara.innerText.trim().substring(0, 400) : '';

    // FIX: Extract Images AND Document Chips for the PDF
    let pdfMediaHtml = '';
    if (srcEl) {
        const imgs = srcEl.querySelectorAll('img');
        imgs.forEach(img => {
            pdfMediaHtml += `<img src="${img.src}" style="max-height:200px; max-width:100%; border-radius:6px; margin-right:10px; margin-bottom:10px; display:inline-block; vertical-align:middle;">`;
        });

        const docs = srcEl.querySelectorAll('.doc-preview-card');
        docs.forEach(doc => {
            const name = doc.querySelector('.doc-preview-name').innerText;
            pdfMediaHtml += `
            <div style="display:inline-flex; align-items:center; background:#1a1f35; border:1px solid #2d3561; border-radius:6px; padding:10px 14px; margin-right:10px; margin-bottom:10px; vertical-align:middle;">
                <span style="font-size:18px; margin-right:10px;">📄</span>
                <span style="font-size:10px; color:#e8edf5; font-weight:700; font-family:sans-serif;">${name}</span>
            </div>`;
        });
    }

    const aiCard    = document.getElementById('aiDetectionCard');
    const mediaCard = document.getElementById('mediaDetectionCard');
    const showAI    = aiCard    && !aiCard.classList.contains('hidden');
    const showMedia = mediaCard && !mediaCard.classList.contains('hidden');
    const aiScore   = (document.getElementById('aiScoreBadge')    || {}).innerText || '';
    const aiText    = (document.getElementById('aiAnalysisText')   || {}).innerText || '';
    const mediaScore= (document.getElementById('mediaScoreBadge') || {}).innerText || '';
    const mediaText = (document.getElementById('mediaAnalysisText')|| {}).innerText || '';

    function vc(v) {
        if (v === 'True')           return { border:'#16a34a', text:'#4ade80', bg:'#0d2b1a', label:'VERIFIED TRUE' };
        if (v === 'False')          return { border:'#dc2626', text:'#f87171', bg:'#2b0d0d', label:'DEBUNKED FALSE' };
        if (v === 'Partially True') return { border:'#d97706', text:'#fbbf24', bg:'#2b1f0d', label:'PARTIALLY TRUE' };
        return                             { border:'#475569', text:'#94a3b8', bg:'#1a1f2b', label:'UNVERIFIABLE' };
    }

    const credColor = credScore >= 80 ? '#4ade80' : credScore >= 50 ? '#fbbf24' : '#f87171';
    const credLabel = credScore >= 80 ? 'HIGH CREDIBILITY' : credScore >= 50 ? 'MODERATE CREDIBILITY' : 'LOW CREDIBILITY';

    function scoreBar(pct, color) {
        const filled = Math.round(pct / 5);
        let s = '';
        for (let i = 0; i < 20; i++) {
            s += '<span style="display:inline-block;width:18px;height:7px;margin-right:2px;border-radius:2px;background:'
               + (i < filled ? color : '#1e2d42') + ';vertical-align:middle;"></span>';
        }
        return s;
    }

    function statCell(val, label, color) {
        return '<td style="width:33%;padding:0 4px;">'
             + '<div style="background:#080c14;border:1px solid #1e2d42;border-radius:6px;padding:10px 8px;text-align:center;">'
             + '<div style="font-size:20px;font-weight:900;color:' + color + ';font-family:monospace;">' + val + '</div>'
             + '<div style="font-size:7.5px;color:#4a5568;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px;">' + label + '</div>'
             + '</div></td>';
    }

    var claimsHTML = '';
    globalResultsData.forEach(function(r, i) {
        var v    = vc(r.verdict);
        var srcs = (r.citations || []).slice(0, 3).map(function(u) {
            return '<div style="font-size:8px;color:#60a5fa;margin-top:3px;word-break:break-all;">' + u + '</div>';
        }).join('');
        claimsHTML +=
            '<div style="page-break-inside: avoid; break-inside: avoid; background:#0f1623;border:1px solid #1e2d42;border-left:3px solid ' + v.border + ';border-radius:6px;padding:14px 16px;margin-bottom:10px;">'
          + '<table style="width:100%;border-collapse:collapse;margin-bottom:8px;"><tr>'
          + '<td style="font-size:9px;color:#6b7a90;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Claim #' + (i+1) + '</td>'
          + '<td style="text-align:right;"><span style="background:' + v.bg + ';border:1px solid ' + v.border + ';color:' + v.text + ';font-size:7.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding:3px 9px;border-radius:20px;">' + v.label + '</span></td>'
          + '</tr></table>'
          + '<div style="font-size:11.5px;font-weight:700;color:#e8edf5;line-height:1.5;margin-bottom:9px;">&ldquo;' + r.claim + '&rdquo;</div>'
          + '<div style="background:#080c14;border-left:2px solid #6366f1;padding:9px 11px;border-radius:0 4px 4px 0;margin-bottom:9px;">'
          + '<div style="font-size:7.5px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Evidence Context</div>'
          + '<div style="font-size:9.5px;color:#a8b4c8;line-height:1.6;font-style:italic;">' + (r.evidence_context || '&mdash;') + '</div>'
          + '</div>'
          + '<div style="font-size:9.5px;color:#a8b4c8;line-height:1.6;' + (srcs ? 'margin-bottom:8px;' : '') + '">' + (r.reasoning || '') + '</div>'
          + (srcs ? '<div style="border-top:1px solid #1e2d42;padding-top:7px;"><div style="font-size:7.5px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px;">Sources</div>' + srcs + '</div>' : '')
          + '</div>';
    });

    var detHTML = '';
    if (showAI || showMedia) {
        var aiBox = showAI
            ? '<div style="background:#0f1623;border:1px solid #1e2d42;border-top:2px solid #60a5fa;border-radius:6px;padding:12px;">'
            + '<div style="font-size:8px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">AI Content Analysis</div>'
            + '<div style="font-size:20px;font-weight:900;color:#60a5fa;font-family:monospace;margin-bottom:5px;">' + aiScore + '</div>'
            + '<div style="font-size:8.5px;color:#6b7a90;line-height:1.5;">' + aiText + '</div>'
            + '</div>' : '';
        var mediaBox = showMedia
            ? '<div style="background:#0f1623;border:1px solid #1e2d42;border-top:2px solid #c084fc;border-radius:6px;padding:12px;">'
            + '<div style="font-size:8px;font-weight:700;color:#c084fc;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">Deepfake Forensic Analysis</div>'
            + '<div style="font-size:20px;font-weight:900;color:#c084fc;font-family:monospace;margin-bottom:5px;">' + mediaScore + '</div>'
            + '<div style="font-size:8.5px;color:#6b7a90;line-height:1.5;">' + mediaText + '</div>'
            + '</div>' : '';

        var detCols = (showAI && showMedia)
            ? '<table style="width:100%;border-collapse:collapse;"><tr>'
            + '<td style="width:50%;padding-right:6px;vertical-align:top;">' + aiBox + '</td>'
            + '<td style="width:50%;padding-left:6px;vertical-align:top;">' + mediaBox + '</td>'
            + '</tr></table>'
            : (aiBox || mediaBox);

        detHTML = '<div style="page-break-inside: avoid; break-inside: avoid; margin-bottom:20px;">'
                + '<div style="font-size:10px;font-weight:800;color:#e8edf5;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1e2d42;">Forensic Detection Analysis</div>'
                + detCols
                + '</div>';
    }

    var html =
        '<div style="background:#080c14;color:#e8edf5;font-family:Arial,Helvetica,sans-serif;width:100%;max-width:800px;margin:0 auto;padding:0;">'
      + '<div style="background:#0d1117;border-bottom:1px solid #1e2d42;padding:28px 34px 22px;">'
      + '<table style="width:100%;border-collapse:collapse;"><tr>'
      + '<td style="vertical-align:top;">'
      + '<div style="background:#1a1f35;border:1px solid #2d3561;border-radius:20px;display:inline-block;padding:4px 12px;margin-bottom:10px;">'
      + '<span style="font-size:8px;font-weight:700;color:#818cf8;letter-spacing:0.1em;text-transform:uppercase;">AI FORENSIC ENGINE &middot; CONFIDENTIAL</span>'
      + '</div>'
      + '<div style="font-size:22px;font-weight:900;color:#f0f4ff;letter-spacing:-0.02em;line-height:1.15;margin-bottom:5px;">Forensic Verification<br>Intelligence Report</div>'
      + '<div style="font-size:9px;color:#6b7a90;letter-spacing:0.02em;">Multi-Agent Claim Analysis &amp; Credibility Assessment</div>'
      + '</td>'
      + '<td style="vertical-align:top;text-align:right;width:175px;">'
      + '<div style="background:#080c14;border:1px solid #1e2d42;border-radius:6px;padding:10px 14px;display:inline-block;text-align:left;">'
      + '<div style="font-size:7.5px;color:#4a5568;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;">Report ID</div>'
      + '<div style="font-size:10px;font-weight:700;color:#818cf8;font-family:monospace;margin-bottom:8px;">' + reportId + '</div>'
      + '<div style="font-size:7.5px;color:#4a5568;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;">Generated</div>'
      + '<div style="font-size:9px;font-weight:600;color:#a8b4c8;">' + dateStr + '</div>'
      + '<div style="font-size:8px;color:#6b7a90;">' + timeStr + '</div>'
      + '</div>'
      + '</td>'
      + '</tr></table>'
      + '<div style="height:2px;background:#1e2d42;margin-top:18px;border-radius:1px;">'
      + '<div style="height:2px;width:35%;background:#6366f1;border-radius:1px;"></div>'
      + '</div>'
      + '</div>'

      + '<div style="padding:22px 34px 34px;">'

      + '<div style="page-break-inside: avoid; break-inside: avoid; background:#0f1623;border:1px solid #1e2d42;border-radius:8px;padding:18px 20px;margin-bottom:18px;">'
      + '<table style="width:100%;border-collapse:collapse;"><tr>'
      + '<td style="vertical-align:middle;width:190px;">'
      + '<div style="font-size:8px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;">Overall Credibility Score</div>'
      + '<div style="font-size:42px;font-weight:900;color:' + credColor + ';font-family:monospace;line-height:1;letter-spacing:-0.02em;">' + credScore + '<span style="font-size:18px;">%</span></div>'
      + '<div style="font-size:8px;font-weight:800;color:' + credColor + ';letter-spacing:0.1em;text-transform:uppercase;margin-top:4px;">' + credLabel + '</div>'
      + '</td>'
      + '<td style="vertical-align:middle;padding-left:18px;">'
      + '<div style="margin-bottom:10px;">' + scoreBar(credScore, credColor) + '</div>'
      + '<table style="width:100%;border-collapse:collapse;"><tr>'
      + statCell(trueCount,  'True',  '#4ade80')
      + statCell(falseCount, 'False', '#f87171')
      + statCell(mixedCount, 'Mixed', '#fbbf24')
      + '</tr></table>'
      + '</td>'
      + '</tr></table>'
      + '</div>'

      // FIX: Inject BOTH the extracted images and the newly styled PDF Document Chips 
      + '<div style="page-break-inside: avoid; break-inside: avoid; background:#0f1623;border:1px solid #1e2d42;border-left:3px solid #6366f1;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:18px;">'
      + '<div style="font-size:7.5px;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;">Source Analysed</div>'
      + (pdfMediaHtml ? `<div style="margin-bottom:10px;">${pdfMediaHtml}</div>` : '')
      + (sourceText ? `<div style="font-size:9.5px;color:#a8b4c8;line-height:1.6;font-style:italic;">${sourceText}${sourceText.length >= 400 ? '&hellip;' : ''}</div>` : '')
      + '</div>'

      + detHTML

      + '<div style="page-break-inside: avoid; break-inside: avoid; font-size:10px;font-weight:800;color:#e8edf5;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #1e2d42;">'
      + 'Claim-by-Claim Breakdown &nbsp;<span style="font-size:8px;color:#4a5568;font-weight:400;">' + total + ' claim' + (total !== 1 ? 's' : '') + ' analysed</span>'
      + '</div>'
      
      + claimsHTML

      + '<div style="page-break-inside: avoid; break-inside: avoid; border-top:1px solid #1e2d42;padding-top:14px;margin-top:8px;">'
      + '<table style="width:100%;border-collapse:collapse;"><tr>'
      + '<td style="vertical-align:top;">'
      + '<div style="font-size:9px;font-weight:700;color:#818cf8;letter-spacing:0.06em;">AI FORENSIC ENGINE</div>'
      + '<div style="font-size:7.5px;color:#4a5568;margin-top:2px;">Automated Fact-Checking &amp; Credibility Analysis</div>'
      + '</td>'
      + '<td style="vertical-align:top;text-align:right;">'
      + '<div style="font-size:7.5px;color:#4a5568;">ID: <span style="color:#6b7a90;font-family:monospace;">' + reportId + '</span></div>'
      + '<div style="font-size:7.5px;color:#4a5568;margin-top:2px;">AI-generated. Verify critical claims independently.</div>'
      + '</td>'
      + '</tr></table>'
      + '</div>'

      + '</div></div>';

    var pdfDoc = document.getElementById('pdfDocument');
    pdfDoc.innerHTML = html;

    document.body.classList.add('pdf-export-mode');

    setTimeout(function() {
        window.print();
        
        setTimeout(function() {
            document.body.classList.remove('pdf-export-mode');
            pdfDoc.innerHTML = '';
        }, 500);
    }, 250);
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