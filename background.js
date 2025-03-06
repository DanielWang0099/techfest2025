// Configuration - Replace these with your actual values
const AZURE_OPENAI_ENDPOINT = "YOUR_AZURE_ENDPOINT"; // e.g., https://your-resource.openai.azure.com/
const AZURE_API_KEY = "YOUR_API_KEY"; // Your Azure OpenAI API key
const DEPLOYMENT_NAME = "YOUR_DEPLOYMENT_NAME"; // The name you gave your model deployment
const YOUTUBE_API_KEY = "AIzaSyDDFkTfwsnVKCiH4mehvJn_aOpq1YIjxTA"; // Your YouTube API key

// Default settings
const DEFAULT_SETTINGS = {
    enabled: true,
    confidence: 'medium',
    warningStyle: 'overlay',
    shortsAnalyzed: 0,
    aiDetected: 0,
    // Azure OpenAI settings
    azureEndpoint: '',
    azureApiKey: '',
    azureDeployment: ''
};

// Initialize settings on extension install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        chrome.storage.sync.set(items);
        console.log('YouTube Shorts AI Detector initialized with settings:', items);
    });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyzeContent') {
        analyzeContent(message.metadata)
            .then(result => {
                // Update stats
                updateStats(result.isAIGenerated);
                
                // Send result back to content script
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'analysisResult',
                    isAIGenerated: result.isAIGenerated,
                    confidence: result.confidence
                });
                
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Analysis error:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        // Return true to indicate async response
        return true;
    }
    
    if (message.action === 'fetchYouTubeData') {
        const videoId = message.videoId;
        fetchVideoData(videoId)
            .then(data => {
                sendResponse({ success: true, data });
            })
            .catch(error => {
                console.error('YouTube API error:', error);
                sendResponse({ success: false, error: error.message });
            });
        
        // Return true to indicate async response
        return true;
    }
    
    // Handle saving Azure API settings
    if (message.action === 'saveAzureSettings') {
        chrome.storage.sync.set({
            azureEndpoint: message.settings.endpoint,
            azureApiKey: message.settings.apiKey,
            azureDeployment: message.settings.deployment
        }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

// Get Azure OpenAI settings from storage
async function getAzureSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['azureEndpoint', 'azureApiKey', 'azureDeployment'], (result) => {
            // Use provided settings or fall back to default constants
            const settings = {
                endpoint: result.azureEndpoint || AZURE_OPENAI_ENDPOINT,
                apiKey: result.azureApiKey || AZURE_API_KEY,
                deployment: result.azureDeployment || DEPLOYMENT_NAME
            };
            resolve(settings);
        });
    });
}

// Analyze content using Azure OpenAI
async function analyzeContent(metadata) {
    // Get confidence setting
    const { confidence } = await chrome.storage.sync.get('confidence');
    
    // Get Azure settings
    const azureSettings = await getAzureSettings();
    
    // Check if Azure settings are configured
    if (!azureSettings.endpoint || !azureSettings.apiKey || !azureSettings.deployment) {
        console.warn('Azure OpenAI settings not fully configured. Using fallback detection.');
        return fallbackAIDetection(metadata, confidence);
    }
    
    // Construct a prompt for the AI
    const prompt = `
    Analyze the following YouTube Shorts metadata and determine if it's likely AI-generated content.
    Use these criteria:
    1. Unnatural or overly generic language
    2. Repetitive patterns or phrases
    3. Unusual syntax combinations
    4. Lacks authenticity or personal voice
    5. Trending clickbait patterns
    
    Confidence setting: ${confidence}
    
    Title: ${metadata.title}
    Channel: ${metadata.channel}
    Description: ${metadata.description || "No description available"}
    
    Respond with ONLY one of these exact phrases: "AI-generated" or "Human-created"
    `;
    
    try {
        // Real implementation using Azure OpenAI
        const apiUrl = `${azureSettings.endpoint}/openai/deployments/${azureSettings.deployment}/chat/completions?api-version=2023-05-15`;
        console.log(`Calling Azure OpenAI API at: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': azureSettings.apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are an AI content detector that analyzes YouTube Shorts." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 10,
                temperature: 0.3 // Lower temperature for more deterministic responses
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Azure API error: ${response.status} - ${errorText}`);
            throw new Error(`Azure OpenAI API error: ${response.status}`);
        }
        
        const result = await response.json();
        const output = result.choices[0].message.content.trim().toLowerCase();
        console.log('Azure OpenAI response:', output);
        
        return {
            isAIGenerated: output.includes("ai-generated"),
            confidence: confidence
        };
    } catch (error) {
        console.error('Azure analysis error:', error);
        console.log('Falling back to local detection method...');
        
        // Fall back to local detection if API fails
        return fallbackAIDetection(metadata, confidence);
    }
}

// Fallback detection when Azure API is not available
function fallbackAIDetection(metadata, confidenceSetting) {
    console.log('Using fallback AI detection method');
    
    // Simple heuristic checks for demo purposes
    const title = metadata.title?.toLowerCase() || '';
    const description = metadata.description?.toLowerCase() || '';
    
    // Check for common AI-generated content patterns
    const clickbaitPhrases = ['you won\'t believe', 'mind-blowing', 'watch till end', 'shocking', 'amazing'];
    const genericPhrases = ['subscribe for more', 'like and share', 'check out my', 'follow for more'];
    const aiPatterns = ['ai generated', 'created with ai', 'made by artificial', 'ai content'];
    
    // Count matches
    let suspiciousScore = 0;
    
    // Check title for clickbait
    clickbaitPhrases.forEach(phrase => {
        if (title.includes(phrase)) suspiciousScore += 2;
    });
    
    // Check for generic phrases
    genericPhrases.forEach(phrase => {
        if (description.includes(phrase)) suspiciousScore += 1;
    });
    
    // Check for explicit AI mentions
    aiPatterns.forEach(pattern => {
        if (title.includes(pattern) || description.includes(pattern)) {
            suspiciousScore += 3;
        }
    });
    
    // Check for very short or empty description
    if (!description || description.length < 10) {
        suspiciousScore += 1;
    }
    
    // Determine threshold based on confidence setting
    let threshold;
    switch (confidenceSetting) {
        case 'low':
            threshold = 1; // More likely to flag content as AI
            break;
        case 'high':
            threshold = 4; // Less likely to flag content as AI
            break;
        case 'medium':
        default:
            threshold = 2;
    }
    
    const isLikelyAI = suspiciousScore >= threshold;
    console.log(`Fallback detection result: ${isLikelyAI ? 'AI-generated' : 'Human-created'} (Score: ${suspiciousScore}, Threshold: ${threshold})`);
    
    return {
        isAIGenerated: isLikelyAI,
        confidence: confidenceSetting
    };
}

// Fetch video data using YouTube API
async function fetchVideoData(videoId) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`YouTube API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            return {
                title: data.items[0].snippet.title,
                channel: data.items[0].snippet.channelTitle,
                description: data.items[0].snippet.description
            };
        } else {
            throw new Error('Video not found');
        }
    } catch (error) {
        console.error('Error fetching YouTube data:', error);
        throw error;
    }
}

// Update statistics
async function updateStats(isAIGenerated) {
    try {
        const stats = await chrome.storage.sync.get(['shortsAnalyzed', 'aiDetected']);
        
        const newStats = {
            shortsAnalyzed: (stats.shortsAnalyzed || 0) + 1,
            aiDetected: isAIGenerated ? (stats.aiDetected || 0) + 1 : (stats.aiDetected || 0)
        };
        
        await chrome.storage.sync.set(newStats);
        
        // Notify popup if open
        chrome.runtime.sendMessage({
            action: 'updateStats',
            stats: newStats
        });
        
        return newStats;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Test connectivity to Azure OpenAI
async function testAzureConnection(settings) {
    try {
        const apiUrl = `${settings.endpoint}/openai/deployments/${settings.deployment}/chat/completions?api-version=2023-05-15`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': settings.apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are an AI assistant." },
                    { role: "user", content: "Test connection. Reply with 'Connected'." }
                ],
                max_tokens: 10
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, error: `API error: ${response.status} - ${errorText}` };
        }
        
        const result = await response.json();
        return { 
            success: true, 
            message: result.choices[0].message.content.trim() 
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}