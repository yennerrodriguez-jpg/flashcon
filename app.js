const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const playerContainer = document.getElementById('player-container');
const downloadBtn = document.getElementById('downloadBtn');
const uploadText = document.getElementById('uploadText');
const counterBadge = document.getElementById('counterBadge');
const resetBtn = document.getElementById('resetBtn');
const historyList = document.getElementById('historyList');

let currentSwfData = null;
let currentFileName = "game.swf";
let uploadCount = parseInt(localStorage.getItem('swf_processed_count')) || 0;
let conversionHistory = JSON.parse(localStorage.getItem('swf_history_list')) || [];

function updateCounterUI() {
    counterBadge.innerText = `Total Files Processed: ${uploadCount}`;
}

function renderHistoryUI() {
    historyList.innerHTML = '';
    if (conversionHistory.length === 0) {
        historyList.innerHTML = '<li class="no-history">No converted files in your history yet.</li>';
        return;
    }
    conversionHistory.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'history-info';
        infoDiv.onclick = () => loadFromHistory(index);
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'history-name';
        nameSpan.innerText = item.name;
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'history-date';
        dateSpan.innerText = item.timestamp;
        
        infoDiv.appendChild(nameSpan);
        infoDiv.appendChild(dateSpan);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-history-btn';
        deleteBtn.innerText = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteHistoryItem(index);
        };
        
        li.appendChild(infoDiv);
        li.appendChild(deleteBtn);
        historyList.appendChild(li);
    });
}

updateCounterUI();
renderHistoryUI();

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#007bff';
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#333';
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#333';
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});

resetBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset your history?")) {
        uploadCount = 0;
        conversionHistory = [];
        localStorage.setItem('swf_processed_count', '0');
        localStorage.setItem('swf_history_list', JSON.stringify([]));
        updateCounterUI();
        renderHistoryUI();
    }
});

function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith('.swf')) {
        alert("Please upload a valid .swf file structure.");
        return;
    }
    currentFileName = file.name;
    uploadText.innerText = `Loaded: ${currentFileName}`;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        currentSwfData = e.target.result;
        initRufflePlayer(currentSwfData);
        downloadBtn.style.display = 'block';
        
        uploadCount++;
        localStorage.setItem('swf_processed_count', uploadCount.toString());
        updateCounterUI();
        
        const timestamp = new Date().toLocaleString();
        const exists = conversionHistory.findIndex(item => item.name === currentFileName);
        if (exists !== -1) conversionHistory.splice(exists, 1);
        if (conversionHistory.length >= 5) conversionHistory.pop();
        
        conversionHistory.unshift({ name: currentFileName, data: currentSwfData, timestamp: timestamp });
        
        try {
            localStorage.setItem('swf_history_list', JSON.stringify(conversionHistory));
        } catch (error) {
            console.warn("Storage space limit exceeded for local history previews.");
        }
        renderHistoryUI();
    };
    reader.readAsDataURL(file);
}

function loadFromHistory(index) {
    const item = conversionHistory[index];
    if (!item) return;
    currentFileName = item.name;
    currentSwfData = item.data;
    uploadText.innerText = `Loaded from history: ${currentFileName}`;
    initRufflePlayer(currentSwfData);
    downloadBtn.style.display = 'block';
}

function deleteHistoryItem(index) {
    conversionHistory.splice(index, 1);
    localStorage.setItem('swf_history_list', JSON.stringify(conversionHistory));
    renderHistoryUI();
}

function initRufflePlayer(swfUrl) {
    playerContainer.innerHTML = '';
    playerContainer.style.display = 'block';
    
    if (!window.RufflePlayer) {
        alert("Ruffle engine failed to initialize. Please check your network connection.");
        return;
    }
    
    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    playerContainer.appendChild(player);
    player.load({ url: swfUrl, allowScriptAccess: true, autoplay: "on" });
}

downloadBtn.addEventListener('click', async () => {
    if (!currentSwfData) return;
    
    downloadBtn.innerText = "Compiling Package...";
    downloadBtn.disabled = true;
    
    try {
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip engine library not loaded yet.");
        }

        const zip = new JSZip();
        
        const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>Embedded Flash Player</title>
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
        #player { width: 100%; height: 100%; }
    </style>
    <script src="https://unpkg.com"></` + `script>
</head>
<body>
    <div id="player"></div>
    <script>
        window.addEventListener("DOMContentLoaded", () => {
            const r = window.RufflePlayer.newest(), p = r.createPlayer();
            document.getElementById("player").appendChild(p);
            p.load({ url: "${currentFileName}", allowScriptAccess: true, autoplay: "on" });
        });
    </` + `script>
</body>
</html>`;

        const response = await fetch(currentSwfData);
        const swfBlob = await response.blob();
        
        zip.file("index.html", standaloneHtml);
        zip.file(currentFileName, swfBlob);
        
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        
        link.download = currentFileName.toLowerCase().replace('.swf', '_html5.zip');
        link.click();
        
    } catch (err) {
        alert("Error compiling zip archive structure: " + err.message);
        console.error(err);
    } finally {
        downloadBtn.innerText = "Download HTML5 Project Package (.zip)";
        downloadBtn.disabled = false;
    }
});
