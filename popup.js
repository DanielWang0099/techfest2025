// DOM elements
const enableDetectionToggle = document.getElementById('enableDetection');
const confidenceSelect = document.getElementById('confidence');
const warningStyleSelect = document.getElementById('warningStyle');
const resetStatsButton = document.getElementById('resetStats');
const shortsAnalyzedElement = document.getElementById('shortsAnalyzed');
const aiDetectedElement = document.getElementById('aiDetected');
const notWatchingElement = document.getElementById('notWatching');
const watchingElement = document.getElementById('watching');
const analyzingStatus = document.getElementById('analyzing');
const detectedStatus = document.getElementById('detected');
const safeStatus = document.getElementById('safe');
const videoTitleElement = document.getElementById('videoTitle');
const channelNameElement = document.getElementById('channelName');

// Load saved settings and stats
document.addEventListener('DOMContentLoaded', async () => {
    // Load settings
    chrome.storage.sync.get({
        enabled: true,
        confidence: 'medium',
        warningStyle: 'overlay',
        shortsAnalyzed: 0,
        aiDetected: 0
    }, (items) => {
        // Update UI with saved settings
        enableDetectionToggle.checked = items.enabled;
        confidenceSelect.value = items.confidence;
        warningStyleSelect.value = items.warningStyle;
        
        // Update stats
        shortsAnalyzedElement.textContent = items.shortsAnalyzed;
        aiDetectedElement.textContent = items.aiDetected;
    });

    // Check if currently viewing a YouTube Short
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes('youtube.com/shorts')) {
        notWatchingElement.classList.add('hidden');
        watchingElement.classList.remove('hidden');
        
        // Query current status from content script
        chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error:', chrome.runtime.lastError);
                return;
            }

            if (response && response.status) {
                updateCurrentShortInfo(response);
            }
        });
    } else {
        notWatchingElement.classList.remove('hidden');
        watchingElement.classList.add('hidden');
    }
});

// Save settings when changed
enableDetectionToggle.addEventListener('change', () => {
    const enabled = enableDetectionToggle.checked;
    chrome.storage.sync.set({ enabled });
    
    // Notify all tabs of the change
    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'updateSettings', 
                settings: { enabled } 
            });
        });
    });
});

confidenceSelect.addEventListener('change', () => {
    const confidence = confidenceSelect.value;
    chrome.storage.sync.set({ confidence });
    
    // Notify all tabs of the change
    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'updateSettings', 
                settings: { confidence } 
            });
        });
    });
});

warningStyleSelect.addEventListener('change', () => {
    const warningStyle = warningStyleSelect.value;
    chrome.storage.sync.set({ warningStyle });
    
    // Notify all tabs of the change
    chrome.tabs.query({ url: '*://*.youtube.com/*' }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'updateSettings', 
                settings: { warningStyle } 
            });
        });
    });
});

// Reset stats
resetStatsButton.addEventListener('click', () => {
    chrome.storage.sync.set({ 
        shortsAnalyzed: 0, 
        aiDetected: 0 
    });
    
    shortsAnalyzedElement.textContent = '0';
    aiDetectedElement.textContent = '0';
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateStats') {
        shortsAnalyzedElement.textContent = message.stats.shortsAnalyzed;
        aiDetectedElement.textContent = message.stats.aiDetected;
    } else if (message.action === 'updateCurrentShort') {
        updateCurrentShortInfo(message);
    }
});

// Update UI with current short information
function updateCurrentShortInfo(data) {
    videoTitleElement.textContent = data.title || 'Unknown';
    channelNameElement.textContent = data.channel || 'Unknown';
    
    // Update status
    analyzingStatus.classList.add('hidden');
    detectedStatus.classList.add('hidden');
    safeStatus.classList.add('hidden');
    
    if (data.status === 'analyzing') {
        analyzingStatus.classList.remove('hidden');
    } else if (data.status === 'ai-detected') {
        detectedStatus.classList.remove('hidden');
    } else if (data.status === 'human-content') {
        safeStatus.classList.remove('hidden');
    }
}