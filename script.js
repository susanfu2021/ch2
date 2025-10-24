document.addEventListener('DOMContentLoaded', () => {
    const ttsIcon = document.getElementById('tts-icon');
    
    // Selector for the entire page container (used by the main icon and as the boundary for paragraph search)
    const PAGE_CONTAINER_SELECTOR = '.pf'; 
    
    // Selector for individual text blocks (the element the user will actually click)
    const TEXT_LINE_SELECTOR = '.t'; 

    // Check for browser support
    if (!('speechSynthesis' in window)) {
        ttsIcon.textContent = "TTS Not Supported";
        ttsIcon.style.color = "red";
        return;
    }

    let isReading = false;
    let isPaused = false;
    let utterance = null;
    let isReadingFullPage = false; 
    
    // Tracks if an individual block/paragraph is currently reading
    let isBlockReading = false; 

    // ----------------------------------------------------------------------
    // --- UTILITY FUNCTIONS ---
    // ----------------------------------------------------------------------

    function getCurrentPageElement() {
        // Finds the most visible page container for full-page reading
        const pageElements = document.querySelectorAll(PAGE_CONTAINER_SELECTOR);
        let closestPage = null;
        let minDistance = Infinity;
        
        for (const page of pageElements) {
            const rect = page.getBoundingClientRect();
            if (rect.bottom > 0 && rect.top < window.innerHeight) { 
                const distance = Math.abs(rect.top); 
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPage = page;
                }
            }
        }
        return closestPage || document.body;
    }

    /**
     * Extracts text from the given element (a paragraph block or the full page).
     * @param {HTMLElement} element The element to extract text from.
     * @param {boolean} isFullPage Flag to use the recursive full-page extraction logic.
     */
    function getBookText(element, isFullPage) {
        if (!element) return "";
        
        if (!isFullPage) {
            // For block reading, we can simply get the text content of the parent block
            // This is the simplest way to get the entire "paragraph" content.
            return (element.textContent || "").replace(/[\n\r\t\s]{2,}/g, ' ');
        }
        
        // --- Full Page Extraction Logic ---
        let text = [];
        function extractText(node) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0) {
                if (node.parentElement && node.parentElement.id !== 'tts-icon') {
                    text.push(node.textContent.trim());
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.id === 'tts-icon' || node.id === 'sidebar') {
                    return;
                }
                for (let child of node.childNodes) {
                    extractText(child);
                }
            }
        }
        extractText(element);
        return text.join(' ').replace(/[\n\r\t\s]{2,}/g, ' ');
    }
    
    function resetReadingState() {
        isReading = false;
        isPaused = false;
        utterance = null;
        isReadingFullPage = false;
        isBlockReading = false; 
        ttsIcon.textContent = '🔊';
        ttsIcon.setAttribute('aria-label', 'Read Aloud');
    }

    // ----------------------------------------------------------------------
    // --- CORE TTS CONTROL ---
    // ----------------------------------------------------------------------

    function speak(textToRead, isFullPage) {
        // Always cancel and reset before starting a new speech
        window.speechSynthesis.cancel();
        resetReadingState();

        if (textToRead.length < 1) {
            return;
        }

        isReadingFullPage = isFullPage;
        isBlockReading = !isFullPage;

        utterance = new SpeechSynthesisUtterance(textToRead);
        
        utterance.onstart = () => {
            isReading = true;
            isPaused = false;
            if (isReadingFullPage) {
                ttsIcon.textContent = '⏸️'; 
                ttsIcon.setAttribute('aria-label', 'Pause Reading');
            }
        };

        utterance.onend = () => {
            // Speech finished, reset state
            resetReadingState();
        };
        
        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event.error);
            resetReadingState();
        };
        
        utterance.rate = 1.0; 
        utterance.pitch = 1.0; 

        window.speechSynthesis.speak(utterance);
    }

    function togglePauseResume() {
        if (!isReading || !isReadingFullPage) return; 
        
        if (isPaused) {
            window.speechSynthesis.resume();
            isPaused = false;
            ttsIcon.textContent = '⏸️';
            ttsIcon.setAttribute('aria-label', 'Pause Reading');
        } else {
            window.speechSynthesis.pause();
            isPaused = true;
            ttsIcon.textContent = '▶️';
            ttsIcon.setAttribute('aria-label', 'Resume Reading');
        }
    }
    
    function stopReading() {
        window.speechSynthesis.cancel();
        resetReadingState();
    }

    // ----------------------------------------------------------------------
    // --- EVENT LISTENERS ---
    // ----------------------------------------------------------------------

    // 1. Main Icon Listener (Full Page, Pause/Resume)
    ttsIcon.addEventListener('click', () => {
        if (!isReading) {
            speak(getBookText(getCurrentPageElement(), true), true);
        } else {
            togglePauseResume();
        }
    });

    ttsIcon.addEventListener('dblclick', (e) => {
        e.preventDefault(); 
        stopReading();
    });
    
    // 2. Content Click Listener (Paragraph Reading / Interruption)
    document.addEventListener('click', (event) => {
        // Ignore clicks on the icon
        if (event.target.closest('#tts-icon')) {
            return;
        }
        
        // Find the specific text line element the user clicked on
        const textLineElement = event.target.closest(TEXT_LINE_SELECTOR);
        
        if (textLineElement) {
            // Find the common ancestor (the likely "paragraph" container)
            // Start from the text line and walk up until we hit the page boundary (.pf)
            let paragraphElement = textLineElement.parentElement;
            while (paragraphElement && !paragraphElement.matches(PAGE_CONTAINER_SELECTOR) && paragraphElement.parentElement) {
                // If the parent is the main page container, stop one level down
                if (paragraphElement.parentElement.matches(PAGE_CONTAINER_SELECTOR)) {
                    break; 
                }
                paragraphElement = paragraphElement.parentElement;
            }

            // --- INTERRUPTION LOGIC ---
            if (isBlockReading) {
                // If a paragraph is already speaking, this click acts as an immediate STOP.
                stopReading();
                return; 
            }
            
            if (isReadingFullPage) {
                 // If reading the full page, interrupt it first.
                 stopReading();
            }

            // --- START NEW PARAGRAPH READING ---
            if (paragraphElement) {
                const textToRead = getBookText(paragraphElement, false);
                speak(textToRead, false);
            }
        }
    });
});