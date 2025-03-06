console.log("YouTube Shorts AI Detector Loaded");

// Function to check if current page is a Short
function isYouTubeShort() {
    return window.location.href.includes('/shorts/');
}

// Function to extract video metadata using DOM elements
function extractMetadata() {
    if (!isYouTubeShort()) {
        console.log("Not a YouTube Short");
        return null;
    }
    
    try {
        // Multiple selector attempts to increase reliability
        const titleSelectors = [
            'h1.title',
            '#shorts-title',
            'yt-formatted-string.ytd-shorts-player-header'
        ];
        
        const channelSelectors = [
            'yt-formatted-string.ytd-channel-name',
            'a.ytd-shorts-player-header'
        ];
        
        // Try each selector until one works
        let title = null;
        for (const selector of titleSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                title = element.textContent.trim();
                break;
            }
        }
        
        let channel = null;
        for (const selector of channelSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                channel = element.textContent.trim();
                break;
            }
        }
        
        // For description, can also try to extract from data objects if DOM fails
        let description = "";
        try {
            // First attempt: try to get from ytInitialPlayerResponse
            if (window.ytInitialPlayerResponse?.videoDetails?.shortDescription) {
                description = window.ytInitialPlayerResponse.videoDetails.shortDescription;
            } 
            // Second attempt: try to find it in the DOM
            else {
                const descElement = document.querySelector('.description');
                if (descElement) {
                    description = descElement.textContent.trim();
                }
            }
        } catch (e) {
            console.error("Error extracting description:", e);
        }
        
        console.log(`Title: ${title}`);
        console.log(`Channel: ${channel}`);
        console.log(`Description: ${description}`);
        
        return { title, channel, description };
    } catch (e) {
        console.error("Error extracting metadata:", e);
        return null;
    }
}

// Function to show AI-generated warning
function showWarning() {
    // Remove any existing warnings first
    const existingWarning = document.getElementById('ai-content-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    let warning = document.createElement("div");
    warning.id = 'ai-content-warning';
    warning.innerText = "⚠ AI-Generated Content";
    warning.style.cssText = "position: absolute; top: 10px; left: 10px; background: red; color: white; padding: 10px; font-size: 16px; z-index: 9999; border-radius: 4px;";
    document.body.appendChild(warning);
}

// Main execution function
function main() {
    if (isYouTubeShort()) {
        console.log("YouTube Short detected");
        // Wait a bit for the page to fully load
        setTimeout(() => {
            const metadata = extractMetadata();
            if (metadata) {
                // In a real implementation, you would send this metadata
                // to your background script for AI analysis first
                // For testing purposes:
                // showWarning();
            }
        }, 1500); // 1.5 second delay
    }
}

// Run on initial page load
main();

// Monitor for navigation within YouTube
window.addEventListener("yt-navigate-finish", main);

// Also use URL change detection as backup
let lastUrl = location.href;
new MutationObserver(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        main();
    }
}).observe(document, {subtree: true, childList: true});

// Additionally monitor for Shorts navigation via scrolling
document.addEventListener('scroll', function() {
    // Debounce to prevent too frequent calls
    clearTimeout(window.scrollDebounce);
    window.scrollDebounce = setTimeout(() => {
        if (isYouTubeShort()) {
            main();
        }
    }, 300);
});