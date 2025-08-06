import { GoogleGenAI } from "@google/genai";
import { marked } from "marked";
import hljs from "highlight.js";
import { SUPPORTED_MODELS, SUPPORTED_PROVIDERS, getDefaultModel, getModelById } from './models.js';

let ai = null;
let autosavedChatId = null;
let selectedModelId = localStorage.getItem('bubbleai_selected_model') || getDefaultModel().id;
let selectedModel = getModelById(selectedModelId);
let tabHeld = false;
const textArea = document.getElementById('textArea');
const sendBtn = document.getElementById('sendBtn');
const responseLengthOptions = ['Default', 'Short', 'Medium', 'Long', 'Full'];
const responseLength = document.getElementById('responseLength');
const responseLengthLabel = document.getElementById('responseLengthLabel');
const addContextBtn = document.getElementById('addContextBtn');
const saveContextBtn = document.getElementById('saveContextBtn');
const contextText = document.getElementById('contextText');
const contextFile = document.getElementById('contextFile');


// Default prompts for fallback
const defaultResponseLengthPresets = [
    "",
    "Answer in as few words or sentences as possible.",
    "Answer in a medium length, at most two paragraphs.",
    "Answer in a long, detailed paragraph.",
    "Answer in a full, comprehensive and elaborate response."
];

const defaultEmoticonInstruction =
    "Start your response with your emoticon, text emoji or plain text  (max 5 characters), then a space, then your answer.";

let emoticonInstruction = loadEmoticonInstruction();


let sortOrder = localStorage.getItem('bubbleai_sort_order') || 'recent';
document.getElementById('sortOrderLabel').textContent = sortOrder === 'recent' ? 'Recent' : 'Oldest';
let promptPosition = localStorage.getItem('bubbleai_prompt_position') || 'top'; // or 'bottom'
let chatHistory = [];
let activeChatId = null;


document.getElementById('darkModeIconBtn').addEventListener('click', function () {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('bubbleai_dark_mode', isDark ? '1' : '0');
    document.getElementById('darkModeIcon').className = isDark ? 'bi bi-sun' : 'bi bi-moon';
});

// On load, set icon state
document.addEventListener('DOMContentLoaded', function () {
    const isDark = localStorage.getItem('bubbleai_dark_mode') === '1';
    if (isDark) document.body.classList.add('dark-theme');
    document.getElementById('darkModeIcon').className = isDark ? 'bi bi-sun' : 'bi bi-moon';
});


marked.setOptions({
    highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    }
});


const savedLength = localStorage.getItem('bubbleai_response_length');
if (savedLength !== null) {
    responseLength.value = savedLength;
    responseLengthLabel.textContent = responseLengthOptions[savedLength];
}


// KEY MANAGEMENT:
//
// ONLY IF USING LOCALLY!! For PUBLIC APPS use OAuth or API proxies.
//
// 1. For local development, you can create src/apikey.js:
//    export const GEMINI_API_KEY = 'your key';
//    Then uncomment the next line to use it:
//    // import { GEMINI_API_KEY } from './apikey.js';
//
// 2. For demos and most users, use localStorage or sessionStorage for the API key.

const isGhPages = window.location.hostname === "kenoleon.github.io";


/**
* Retrieves the stored Gemini API key from localStorage or sessionStorage.
* @returns {string} The API key if stored, empty string if not found.
*/
function getApiKey() {
    // Uncomment the next line if using apikey.js for local dev:
    // if (typeof GEMINI_API_KEY !== 'undefined') return GEMINI_API_KEY;
    if (isGhPages) {
        return sessionStorage.getItem('bubbleai_api_key') || '';
    } else {
        return localStorage.getItem('bubbleai_api_key') || '';
    }
}

/** 
 * Stores the Gemini API key in localStorage or sessionStorage.
 * @param {string} key - The API key to store.
*/
function setApiKey(key) {
    if (isGhPages) {
        sessionStorage.setItem('bubbleai_api_key', key);
    } else {
        localStorage.setItem('bubbleai_api_key', key);
    }
    updateStorageMeter();
}

/**
* Updates the UI to show the current API key status.
* Shows success state if key is set, warning if not 
* Also sets up the change API key button functionality.
*/
function updateApiKeyStatus() {
    const apiKey = getApiKey();
    const statusDiv = document.getElementById('apiKeyStatus');
    if (apiKey) {
        statusDiv.className = "alert alert-success p-2 my-2";
        statusDiv.innerHTML = `Gemini API key set <span style="font-size:0.9em;">(hidden)</span>
            <button class="btn btn-link btn-sm p-0" id="setApiKeyBtn">(Change)</button>`;
    } else {
        statusDiv.className = "alert alert-warning p-2 my-2";
        statusDiv.innerHTML = `No Gemini API key set.
            <button class="btn btn-link btn-sm p-0" id="setApiKeyBtn">(Set Key)</button>`;
    }
    document.getElementById('setApiKeyBtn').onclick = () => {
        document.getElementById('apiKeyInput').value = '';
        $('#apiKeyModal').modal('show');
    };
}

// Save key from modal
document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
        setApiKey(key);
        $('#apiKeyModal').modal('hide');
        updateApiKeyStatus();
        initializeModel(selectedModel);
    }
});


function initializeModel(selectedModel) {
    const key = getApiKey();
    if (key) {
        ai = new GoogleGenAI({ apiKey: key });
    }
    document.getElementById('currentModelLabel').textContent = `Model: ${selectedModel.name}`;
}



// LOCAL STORAGE:

/**
 * Loads saved contexts from localStorage 
 * @returns {Array} Array of context objects, empty array if none stored.
 */
function loadContextsFromStorage() {
    const data = localStorage.getItem('bubbleai_contexts');
    return data ? JSON.parse(data) : [];
}

/**
 * Calculates the total size of localStorage data in megabytes
 * @returns {number} Size in MB rounded to 4 decimal places
 */
function getLocalStorageSizeMB() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2); // 2 bytes per char
        }
    }
    return total / (1024 * 1024); // MB
}

/**
 * Updates the storage meter UI to show current localStorage usage
 * Changes color based on usage percentage (green/yellow/red)
 * Updates labels with current and max values
 */
function updateStorageMeter() {
    const used = getLocalStorageSizeMB();
    const max = 5; // Most browsers allow 5MB
    const percent = Math.min(100, (used / max) * 100);

    document.getElementById('storageUsedLabel').textContent = used.toFixed(4);
    document.getElementById('storageMaxLabel').textContent = max;
    document.getElementById('storageMeterBar').style.width = percent + '%';

    // Optional: change color if near full
    document.getElementById('storageMeterBar').style.background =
        percent > 90 ? 'linear-gradient(90deg, #EA885B, #D6AD5C)' :
            percent > 70 ? 'linear-gradient(90deg, #D6AD5C, #EA885B)' :
                'linear-gradient(90deg, #bfc4cc, #9cacbe)';
}

/**
 * Saves the current contexts array to localStorage
 * Updates the storage meter after saving
*/
function saveContextsToStorage() {
    localStorage.setItem('bubbleai_contexts', JSON.stringify(contexts));
    updateStorageMeter();
}

/**
 * Clears all app-related data from localStorage and sessionStorage
 * Removes API keys, chats, contexts, and settings
 * Reloads the page after clearing
 */
function clearAppStorage() {
    // Remove all app-related localStorage keys
    [
        'bubbleai_contexts',
        'bubbleai_api_key',
        'bubbleai_chats',
        'bubbleai_sort_order',
        'bubbleai_dark_mode',
        'bubbleai_response_length',
        'bubbleai_prompt_position'
    ].forEach(key => localStorage.removeItem(key));

    // Also clear sessionStorage API key if on GitHub Pages
    if (isGhPages) {
        sessionStorage.removeItem('bubbleai_api_key');
    }

    location.reload();
    updateStorageMeter();
}


document.getElementById('clearAppDataBtn').addEventListener('click', clearAppStorage);

// HELPER FUNCTIONS:


/**
 * Changes the chat sort order and updates the UI
 * @param {string} newOrder - Either 'recent' or 'oldest'
 */
function setSortOrder(newOrder) {
    sortOrder = newOrder;
    localStorage.setItem('bubbleai_sort_order', sortOrder);
    document.getElementById('sortOrderLabel').textContent = sortOrder === 'recent' ? 'Recent' : 'Oldest';
}

/**
 * Shows the loading animation for pending prompts
 * Creates animated circles in the loading bubble container
 */
function showPromptLoadingBubble() {
    const container = document.getElementById('loadingBubblePrompt');
    if (!container) return;
    container.innerHTML = `
        <div class="bubble-loading-circles">
            <span class="loading-circle"></span>
            <span class="loading-circle"></span>
            <span class="loading-circle"></span>
        </div>
    `;
}

/**
 * Removes the loading animation from the prompt area
 * Clears the loading bubble container
 */
function removePromptLoadingBubble() {
    const container = document.getElementById('loadingBubblePrompt');
    if (container) container.innerHTML = '';
}



// CHAT HISTORY MANAGEMENT:

/**
 * Converts chat history array to a formatted string for AI prompts
 * @param {Array} history - Array of chat messages with role and text properties
 * @param {number} maxTurns - Maximum number of conversation turns to include (default: 10) 
 * @returns {string} Formatted chat history string
 */
function buildChatHistoryString(history, maxTurns = 10) {
    // Only include the last N turns for brevity
    let turns = [];
    for (let i = Math.max(0, history.length - maxTurns * 2); i < history.length; i += 2) {
        const user = history[i];
        const llm = history[i + 1];
        if (user && user.role === 'user') {
            turns.push(`User: ${user.text}`);
        }
        if (llm && llm.role === 'llm') {
            turns.push(`AI: ${llm.text}`);
        }
    }
    return turns.join('\n');
}


/**
 * Saves the current chat to localStorage
 * Prompts user for chat name and creates a new chat entry
 * Updates activeChatId and re-renders chat list
 */
function saveCurrentChat() {
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    const name = prompt('Name this chat:', `Chat ${chats.length + 1}`);
    if (!name) return;
    const id = Date.now();
    chats.push({
        id,
        name,
        color: '#626262ff',
        history: JSON.parse(JSON.stringify(chatHistory)),
        created: new Date().toISOString(),
        chatWidth: chatWidthSlider.value // Save current width
    });
    localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
    updateStorageMeter();
    activeChatId = id;
    renderChatList();
}


// MAIN CHAT DISPLAY

/**
 * Renders the list of saved chats in the sidebar 
 * Creates buttons for each chat with edit and delete options
 * Highlights the currently active chat
 */
function renderChatList() {
    const chatListDiv = document.getElementById('chatList');
    chatListDiv.innerHTML = '';
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    chats.forEach((chat, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center mb-1 chat-list-row';

        // Color bar
        const colorBar = document.createElement('span');
        colorBar.className = 'chat-color-bar';
        colorBar.style.background = chat.color || '#e0e0e0';

        // Chat select button
        const btn = document.createElement('button');
        btn.className = 'btn btn-block btn-sm text-left chat-list-btn flex-grow-1';
        btn.textContent = chat.name || `Chat ${idx + 1}`;
        btn.title = `Saved: ${chat.created ? new Date(chat.created).toLocaleString() : ''}`;

        // Neutral background, border for active
        btn.style.background = '';
        btn.style.border = (chat.id === activeChatId)
            ? `2px solid ${chat.color || '#e0e0e0'}`
            : '1px solid #bfc4cc';
        btn.style.boxShadow = (chat.id === activeChatId)
            ? `0 0 0 2px ${chat.color || '#e0e0e0'}33`
            : 'none';

        if (chat.id === activeChatId) {
            btn.classList.add('active');
            btn.style.setProperty('--chat-active-border', chat.color || '#bfc4cc');
        } else {
            btn.classList.remove('active');
            btn.style.removeProperty('--chat-active-border');
        }

        btn.onclick = () => {
            loadChat(idx);
        };

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn icon-btn-trash';
        deleteBtn.title = 'Delete this chat';
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteChat(idx);
        };

        // Edit (rename) button
        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn';
        editBtn.title = 'Edit name and color';
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openEditChatModal(idx);
        };

        wrapper.appendChild(colorBar);
        wrapper.appendChild(btn);
        wrapper.appendChild(editBtn);
        wrapper.appendChild(deleteBtn);
        chatListDiv.appendChild(wrapper);
    });
}

/**
 * Loads a specific chat from localStorage
 * @param {number} idx - Index of the chat to load
 * Restores chat history and width settings
 */
function loadChat(idx) {
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    if (!chats[idx]) return;
    chatHistory = JSON.parse(JSON.stringify(chats[idx].history));
    activeChatId = chats[idx].id;

    // Restore chat width if present
    if (chats[idx].chatWidth) {
        chatWidthSlider.value = chats[idx].chatWidth;
        chatWidthLabel.textContent = chats[idx].chatWidth + '%';
        updateBubblesColWidth();
    }

    renderChatHistory();
    renderChatList();
    updateBubblesColWidth();
}

/**
 * Deletes a chat from localStorage
 * @param {number} idx - Index of the chat to delete
 * Updates chat list and loads another chat if current one is deleted
 */
function deleteChat(idx) {
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    if (!chats[idx]) return;
    chats.splice(idx, 1);
    localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
    updateStorageMeter();
    // If the deleted chat is the current one, clear chatHistory or load another
    if (chats.length === 0) {
        chatHistory = [];
    } else if (idx === 0) {
        chatHistory = JSON.parse(JSON.stringify(chats[0].history));
    } else {
        chatHistory = JSON.parse(JSON.stringify(chats[idx - 1].history));
    }
    renderChatList();
    renderChatHistory();
}

/**
 * Opens the edit chat modal for renaming and color selection.
 * @param {number} idx - Index of the chat to edit.
 */
function openEditChatModal(idx) {
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    if (!chats[idx]) return;
    document.getElementById('editChatNameInput').value = chats[idx].name || `Chat ${idx + 1}`;
    document.getElementById('chatColorInput').value = chats[idx].color || '#e0e0e0';

    $('#editChatModal').modal('show');

    document.getElementById('saveEditChatBtn').onclick = function () {
        const newName = document.getElementById('editChatNameInput').value.trim();
        if (newName) chats[idx].name = newName;
        chats[idx].color = document.getElementById('chatColorInput').value;
        localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
        renderChatList();
        $('#editChatModal').modal('hide');
    };
}

/**
 * Updates the currently active chat in localStorage
 * Saves the current chat history to the active chat
 */
function updateActiveChatInStorage() {
    if (!activeChatId) return;
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    const idx = chats.findIndex(chat => chat.id === activeChatId);
    if (idx !== -1) {
        chats[idx].history = JSON.parse(JSON.stringify(chatHistory));
        localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
        updateStorageMeter();
    }
}


document.getElementById('addChatBtn').addEventListener('click', () => {
    autosavedChatId = null;
    activeChatId = null;
    chatHistory = [];
    activeChatId = null;
    contexts.forEach(ctx => ctx.active = false);
    saveContextsToStorage();
    renderContextList();

    // Set default width for new chat
    const defaultWidth = 90;
    chatWidthSlider.value = defaultWidth;
    chatWidthLabel.textContent = defaultWidth + '%';


    renderChatHistory();
    renderChatList();
    updateBubblesColWidth();
});


// Chat Width

const chatWidthSlider = document.getElementById('chatWidthSlider');
const chatWidthLabel = document.getElementById('chatWidthLabel');

/**
 * Updates the width of chat bubbles based on slider value
 * Applies width to all bubble containers and sets max-width for individual bubbles
 * Saves the width setting to the active chat in localStorage
 */
function updateBubblesColWidth() {
    const width = chatWidthSlider.value;
    chatWidthLabel.textContent = width + '%';
    document.querySelectorAll('.bubbles-col').forEach(col => {
        col.style.width = width + '%';
        col.style.marginLeft = 'auto';
        col.style.marginRight = 'auto';
        col.style.transition = 'width 0.2s';
    });

    // Dynamically set max-width for .bubble-llm
    document.querySelectorAll('.bubble-llm').forEach(bubble => {
        if (width === "100") {
            bubble.style.maxWidth = "100%";
        } else {
            bubble.style.maxWidth = Math.max(40, width) + "%";
        }
    });

    document.querySelectorAll('.bubble-user').forEach(bubble => {
        if (width === "100") {
            bubble.style.maxWidth = "100%";
        } else {
            bubble.style.maxWidth = Math.max(40, width) + "%";
        }
    });

    // Save width to the active chat
    if (activeChatId) {
        let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
        const idx = chats.findIndex(chat => chat.id === activeChatId);
        if (idx !== -1) {
            chats[idx].chatWidth = width;
            localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
        }
    }
}

// Update on slider input
chatWidthSlider.addEventListener('input', updateBubblesColWidth);

// Update after chat renders
const origRenderChatHistory = renderChatHistory;
window.renderChatHistory = function () {
    origRenderChatHistory.apply(this, arguments);
    updateBubblesColWidth();
};


// CONTEXT BLOCK:

let contexts = loadContextsFromStorage();
renderContextList();
let editingContextIdx = null;
const contextTitle = document.getElementById('contextTitle');

contextFile.addEventListener('change', function () {
    const file = contextFile.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            contextText.value = e.target.result;
        };
        reader.readAsText(file);
    }
});

saveContextBtn.addEventListener('click', () => {
    const title = contextTitle.value.trim() || `Context ${contexts.length + 1}`;
    const text = contextText.value.trim();
    if (text) {
        contexts.push({ title, content: text, active: true });
        saveContextsToStorage();
        contextTitle.value = '';
        contextText.value = '';
        contextFile.value = '';
        $('#contextModal').modal('hide');
        renderContextList();
    }
});

/**
 * Updates the active context marker above the prompt area.
 * Renders one short green bar for each active context, or hides the marker if none are active.
 * Should be called after adding, toggling, or deleting contexts to keep the indicator in sync.
 */

function updateActiveContextMarker() {
    const marker = document.getElementById('activeContextMarker');
    if (!marker) return;
    const activeCount = contexts ? contexts.filter(ctx => ctx.active).length : 0;
    marker.innerHTML = '';
    if (activeCount > 0) {
        marker.style.display = 'flex';
        for (let i = 0; i < activeCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'context-bar';
            marker.appendChild(bar);
        }
        marker.title = activeCount === 1 ? "1 active context" : `${activeCount} active contexts`;
    } else {
        marker.style.display = 'none';
    }
}


/**
 * Renders the list of contexts in the sidebar
 * Creates buttons for each context with inspect and toggle options
 * Shows active/inactive state for each context
 */
function renderContextList() {
    const contextList = document.getElementById('contextList');
    contextList.innerHTML = '';
    contexts.forEach((ctx, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center mb-1';

        // Context label
        const label = document.createElement('span');
        label.textContent = ctx.title || `Context ${idx + 1}`;
        label.className = 'flex-grow-1 context-title context-list-btn' + (ctx.active ? ' active' : '');

        // Inspect icon button
        const inspectBtn = document.createElement('button');
        inspectBtn.className = 'icon-btn';
        inspectBtn.innerHTML = '<i class="bi bi-eye"></i>';
        inspectBtn.onclick = () => openContextModal(idx);

        // Active toggle icon button
        const activeBtn = document.createElement('button');
        activeBtn.className = 'icon-btn icon-btn-active';
        if (ctx.active) {
            activeBtn.className = 'icon-btn icon-btn-active active';
            activeBtn.innerHTML = '<i class="bi bi-dash"></i>';
        } else {
            activeBtn.className = 'icon-btn icon-btn-active';
            activeBtn.innerHTML = '<i class="bi bi-check-circle"></i>';
        }
        activeBtn.onclick = () => {
            ctx.active = !ctx.active;
            saveContextsToStorage();
            renderContextList();
        };

        wrapper.appendChild(label);
        wrapper.appendChild(inspectBtn);
        wrapper.appendChild(activeBtn);
        contextList.appendChild(wrapper);
        updateActiveContextMarker();
    });
}

/**
 * Opens the context inspection modal for editing
 * @param {number} idx - Index of the context to edit
 * Populates modal fields with context data
 */
function openContextModal(idx) {
    editingContextIdx = idx;
    const ctx = contexts[idx];
    document.getElementById('inspectContextTitle').value = ctx.title || `Context ${idx + 1}`;
    document.getElementById('inspectContextContent').value = ctx.content;
    $('#inspectContextModal').modal('show');
}

document.getElementById('saveEditContextBtn').addEventListener('click', () => {
    if (editingContextIdx !== null) {
        const newTitle = document.getElementById('inspectContextTitle').value.trim() || `Context ${editingContextIdx + 1}`;
        const newContent = document.getElementById('inspectContextContent').value;
        contexts[editingContextIdx].title = newTitle;
        contexts[editingContextIdx].content = newContent;
        saveContextsToStorage();
        renderContextList();
        $('#inspectContextModal').modal('hide');
        editingContextIdx = null;
    }
});

document.getElementById('deleteContextBtn').addEventListener('click', () => {
    if (editingContextIdx !== null) {
        // Remove the context from the array
        contexts.splice(editingContextIdx, 1);
        saveContextsToStorage();
        renderContextList();
        updateActiveContextMarker();
        $('#inspectContextModal').modal('hide');
        editingContextIdx = null;
    }
});


$('#inspectContextModal').on('hidden.bs.modal', function () {
    editingContextIdx = null;
});

// CONTEXT BLOCK


/**
 * Moves the prompt input to either top or bottom of chat area
 * Updates UI icons and scrolls to appropriate position
 * Handles smooth scrolling and positioning
 */
function updatePromptPosition() {
    const promptContainer = document.getElementById('promptContainer');
    const chatArea = document.getElementById('chatArea');
    if (!promptContainer || !chatArea) return;

    const parent = chatArea.parentNode;
    const mainCol = document.querySelector('.col-sm-8.p-4');


    if (promptPosition === 'bottom') {
        parent.appendChild(promptContainer);
        document.getElementById('promptPositionIcon').className = 'bi bi-arrow-up';
        promptContainer.style.marginTop = '0.5rem';
        setTimeout(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
            window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
        }, 0);
    } else {
        parent.insertBefore(promptContainer, chatArea);
        document.getElementById('promptPositionIcon').className = 'bi bi-arrow-down';
        promptContainer.style.marginTop = '0';
        promptContainer.style.marginBottom = '0.5rem';
        setTimeout(() => {
            chatArea.scrollTop = 0;
            const rect = promptContainer.getBoundingClientRect();
            const col = document.querySelector('.col-sm-8.p-4');
            const pad = parseInt(getComputedStyle(col).paddingTop || 0);
            window.scrollTo({
                top: Math.max(0, Math.round(window.scrollY + rect.top - pad - 15)),
                behavior: "smooth"
            });
        }, 0);
    }
}


// LISTENERS



document.getElementById('viewChatMemoryBtn').addEventListener('click', () => {
    // Build the chat memory string (same as used for prompt)
    const chatMemory = buildChatHistoryString(chatHistory);
    const note = "Note: Context and Model version are not saved as part of the chat history. The context(s) active during each message and model version are not recorded.\n\n";
    document.getElementById('chatMemoryContent').textContent = note + (chatMemory || "(No chat memory yet)");
    $('#chatMemoryModal').modal('show');
});



document.getElementById('togglePromptPositionBtn').addEventListener('click', () => {
    promptPosition = (promptPosition === 'top') ? 'bottom' : 'top';
    localStorage.setItem('bubbleai_prompt_position', promptPosition);
    renderChatHistory();
    updatePromptPosition();
    updateBubblesColWidth();
});


document.getElementById('toggleSortBtn').addEventListener('click', () => {
    setSortOrder(sortOrder === 'recent' ? 'oldest' : 'recent');
    renderChatHistory();
    updateBubblesColWidth();
});


addContextBtn.addEventListener('click', () => {
    $('#contextModal').modal('show');
});


responseLength.addEventListener('input', () => {
    responseLengthLabel.textContent = responseLengthOptions[responseLength.value];
    localStorage.setItem('bubbleai_response_length', responseLength.value);
});

/**
 * Updates the send button state based on text input and Tab key
 * Enables button only when text is present and Tab is held
 * Adds/removes 'primed' class for visual feedback
 */
function updateSendBtn() {
    if (textArea.value.trim() && tabHeld) {
        sendBtn.disabled = false;
        sendBtn.classList.add('primed');
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.remove('primed');
    }
}

textArea.addEventListener('input', updateSendBtn);

textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
        tabHeld = true;
        updateSendBtn();
        e.preventDefault();
    }
    if (tabHeld && e.key === 'Enter' && !sendBtn.disabled) {
        sendBtn.click();
        e.preventDefault();
    }
});

textArea.addEventListener('keyup', (e) => {
    if (e.key === 'Tab') {
        tabHeld = false;
        updateSendBtn();
    }
});

sendBtn.addEventListener('mouseover', () => {
    if (textArea.value.trim()) {
        sendBtn.disabled = false;
        sendBtn.classList.add('primed');
    }
});

sendBtn.addEventListener('mouseout', () => {
    // Only un-prime if Tab is not held
    if (!(textArea.value.trim() && tabHeld)) {
        sendBtn.disabled = true;
        sendBtn.classList.remove('primed');
    }
});

// Send button click handler

sendBtn.addEventListener('click', async () => {
    const text = textArea.value.trim();
    if (!text) return;

    // 1. Add the user's prompt as pending and render immediately
    chatHistory.push({ role: 'user', text, pending: true });
    renderChatHistory();
    updateBubblesColWidth();
    textArea.value = '';
    tabHeld = false;
    updateSendBtn();

    // 2. Get the response length instruction
    const lengthValue = responseLength.value;
    const responseLengthPresets = loadResponseLengthPrompts();
    const prePrompt = responseLengthPresets[lengthValue];

    // 3. Gather active contexts
    const activeContexts = contexts.filter(ctx => ctx.active);
    let contextBlock = "";
    if (activeContexts.length > 0) {
        contextBlock = "Use this as context for your answer:\n\n";
        contextBlock += activeContexts.map(ctx => ctx.title ? `[${ctx.title}]\n${ctx.content}` : ctx.content).join('\n\n');
        contextBlock += "\n\n";
    }

    // 4. Check if chat history is enabled and build the prompt
    const chatHistoryEnabled = document.getElementById('chatHistoryToggle')?.checked;
    let historyBlock = '';
    if (chatHistoryEnabled) {
        historyBlock = buildChatHistoryString(chatHistory);
    }

    // 5. Build the full prompt
    const showAvatar = document.getElementById('toggleAvatar')?.checked;
    let fullPrompt = '';
    if (showAvatar) {
        fullPrompt += emoticonInstruction;
    }
    fullPrompt += `${contextBlock}${prePrompt}\n\n`;
    if (chatHistoryEnabled && historyBlock) {
        fullPrompt += `${historyBlock}\n`;
    }
    fullPrompt += `User: ${text}`;

    // 6. Show the loading indicator
    showPromptLoadingBubble();

    // 7. Call the model and handle the response
    try {
        if (selectedProviderId === "gemini") {
            // --- Gemini logic (existing) ---
            const apiParams = selectedModel.getApiParams(fullPrompt);
            const result = await ai.models.generateContent(apiParams);
            removePromptLoadingBubble();

            // Unmark pending for the last user prompt
            for (let i = chatHistory.length - 1; i >= 0; i--) {
                if (chatHistory[i].role === 'user' && chatHistory[i].pending) {
                    chatHistory[i].pending = false;
                    break;
                }
            }

            // Parse emoticon and answer from LLM response
            const rawResponse = result.text;
            let emoticon = ':|';
            let answer = rawResponse;

            if (showAvatar) {
                const match = rawResponse.match(/^([^\s]{1,5})\s+(.*)$/s);
                if (match) {
                    emoticon = match[1];
                    answer = match[2].trim();
                }
            }

            chatHistory.push({ role: 'llm', text: answer, emoticon });
            renderChatHistory();
            updateBubblesColWidth();
            updateActiveChatInStorage();

            // AUTOSAVE LOGIC (unchanged)
            const autosaveEnabled = document.getElementById('autosaveChatToggle')?.checked;
            if (autosaveEnabled && !activeChatId && !autosavedChatId) {
                let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
                const id = Date.now();
                chats.push({
                    id,
                    name: `Chat ${chats.length + 1}`,
                    color: '#626262ff',
                    history: JSON.parse(JSON.stringify(chatHistory)),
                    created: new Date().toISOString(),
                    chatWidth: chatWidthSlider.value
                });
                localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
                updateStorageMeter();
                activeChatId = id;
                autosavedChatId = id;
                renderChatList();
            }

        } else if (selectedProviderId === "custom") {
            // --- Custom API logic ---
            const endpoint = localStorage.getItem('bubbleai_custom_api_endpoint');
            if (!endpoint) throw new Error("No custom API endpoint set.");

            // Send POST request to custom endpoint
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: fullPrompt })
            });
            removePromptLoadingBubble();

            // Unmark pending for the last user prompt
            for (let i = chatHistory.length - 1; i >= 0; i--) {
                if (chatHistory[i].role === 'user' && chatHistory[i].pending) {
                    chatHistory[i].pending = false;
                    break;
                }
            }

            if (!response.ok) throw new Error("Custom API error: " + response.statusText);
            const data = await response.json();

            // Use data.response or similar (depends on your API)
            let answer = data.response || "No response";
            let emoticon = ':|';

            if (showAvatar) {
                const match = answer.match(/^([^\s]{1,5})\s+(.*)$/s);
                if (match) {
                    emoticon = match[1];
                    answer = match[2].trim();
                }
            }

            chatHistory.push({ role: 'llm', text: answer, emoticon });
            renderChatHistory();
            updateBubblesColWidth();
            updateActiveChatInStorage();

            // AUTOSAVE LOGIC (unchanged)
            const autosaveEnabled = document.getElementById('autosaveChatToggle')?.checked;
            if (autosaveEnabled && !activeChatId && !autosavedChatId) {
                let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
                const id = Date.now();
                chats.push({
                    id,
                    name: `Chat ${chats.length + 1}`,
                    color: '#626262ff',
                    history: JSON.parse(JSON.stringify(chatHistory)),
                    created: new Date().toISOString(),
                    chatWidth: chatWidthSlider.value
                });
                localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
                updateStorageMeter();
                activeChatId = id;
                autosavedChatId = id;
                renderChatList();
            }
        }

    } catch (e) {
        removePromptLoadingBubble();

        // Unmark pending for the last user prompt
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].role === 'user' && chatHistory[i].pending) {
                chatHistory[i].pending = false;
                break;
            }
        }

        chatHistory.push({ role: 'llm', text: "Error: " + (e.message || e) });
        renderChatHistory();
        updateBubblesColWidth();
        updateActiveChatInStorage();
    }
});

/**
 * Renders the main chat display area
 * Groups messages into user/AI pairs and handles sort order 
 * Creates delete buttons for each message pair 
 * Applies chat width settings and auto-scrolls based on sort order
 */
function renderChatHistory() {
    let chat = document.getElementById('chatArea');
    if (!chat) {
        chat = document.createElement('div');
        chat.id = 'chatArea';
        chat.className = 'chat-area flex-grow-1 mb-3';
        document.querySelector('.col-sm-8.p-4').appendChild(chat);
    }
    chat.innerHTML = '';

    // Group messages as user/llm pairs
    let pairs = [];
    for (let i = 0; i < chatHistory.length; i += 2) {
        pairs.push([chatHistory[i], chatHistory[i + 1]]);
    }
    if (
        (promptPosition === 'top' && sortOrder === 'recent') ||
        (promptPosition === 'bottom' && sortOrder === 'oldest')
    ) {
        pairs = pairs.slice().reverse();
    }

    pairs.forEach(([userMsg, aiMsg], pairIdx) => {
        // Outer row for the pair
        const rowDiv = document.createElement('div');
        rowDiv.className = 'chat-pair d-flex flex-row align-items-start mb-2';

        // Message bubbles column (vertical stack)
        const bubblesCol = document.createElement('div');
        const width = chatWidthSlider.value;
        bubblesCol.style.width = width + '%';
        bubblesCol.style.marginLeft = 'auto';
        bubblesCol.style.marginRight = 'auto';
        bubblesCol.style.transition = 'none';

        bubblesCol.className = 'bubbles-col d-flex flex-column align-items-stretch';

        // Row for user bubble and delete button
        if (userMsg) {
            const userRow = document.createElement('div');
            userRow.className = 'd-flex align-items-center mb-1';

            // Delete button (left of user bubble)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'icon-btn icon-btn-trash pair-delete-btn';
            deleteBtn.title = 'Delete this prompt/response pair';
            deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            deleteBtn.onclick = () => {
                let idx = pairIdx * 2;
                if (sortOrder === 'recent') {
                    idx = chatHistory.length - (pairIdx + 1) * 2;
                }
                chatHistory.splice(idx, 2);
                renderChatHistory();
                updateActiveChatInStorage();
            };
            userRow.appendChild(deleteBtn);

            // User bubble
            displayMessage(userMsg.text, 'user', userRow, userMsg.pending);

            bubblesCol.appendChild(userRow);
        }

        // LLM bubble (no delete button)
        const showAvatar = document.getElementById('toggleAvatar')?.checked;
        if (aiMsg) {
            if (showAvatar) {
                // Create avatar element
                const avatarDiv = document.createElement('div');
                avatarDiv.className = 'avatar-face mr-2';
                const emoticon = aiMsg.emoticon || ':|';
                avatarDiv.innerHTML = `<div class="avatar-emoticon">${emoticon}</div>`;

                // Create a wrapper for avatar + AI bubble
                const aiRow = document.createElement('div');
                aiRow.className = 'd-flex align-items-start';

                aiRow.appendChild(avatarDiv);
                displayMessage(aiMsg.text, 'llm', aiRow);

                bubblesCol.appendChild(aiRow);
            } else {
                // Just show the AI response, no avatar
                displayMessage(aiMsg.text, 'llm', bubblesCol);
            }
        }

        // Assemble row
        rowDiv.appendChild(bubblesCol);
        chat.appendChild(rowDiv);
    });

    // Auto-scroll based on sort order
    if (sortOrder === 'oldest') {
        chat.scrollTop = chat.scrollHeight;
    } else {
        chat.scrollTop = 0;
    }
}


// CUSTOM PROMPTS FOR AI UI ELEMENTS ( emoticon, prePrompt, etc.)

// EDIT RESPONSE LENGTH PROMPTS:

document.getElementById('editResponseLengthPrompt').addEventListener('click', () => {
    const prompts = loadResponseLengthPrompts();
    console.log('Loaded response length prompts:', prompts);
    let html = '';
    prompts.forEach((prompt, idx) => {
        const label = responseLengthOptions && responseLengthOptions[idx] ? responseLengthOptions[idx] : `Preset ${idx}`;
        html += `
            <div class="form-group">
                <label>${label}:</label>
                <input type="text" class="form-control response-length-input" data-idx="${idx}" value="${prompt}">
            </div>
        `;
    });
    document.getElementById('responseLengthModalBody').innerHTML = html;
    $('#responseLengthModal').modal('show');
});

document.getElementById('saveResponseLengthBtn').onclick = () => {
    const inputs = document.querySelectorAll('.response-length-input');
    const prompts = Array.from(inputs).map(input => input.value);
    saveResponseLengthPrompts(prompts);
    $('#responseLengthModal').modal('hide');
};

document.getElementById('resetResponseLengthBtn').onclick = () => {
    const prompts = [...defaultResponseLengthPresets];
    document.querySelectorAll('.response-length-input').forEach((input, idx) => {
        input.value = prompts[idx];
    });
};

// EDIT AVATAR PROMPT:

document.getElementById('editAvatarPrompt').addEventListener('click', () => {
    document.getElementById('avatarPromptInput').value = loadEmoticonInstruction();
    $('#avatarPromptModal').modal('show');
});

document.getElementById('saveAvatarPromptBtn').onclick = () => {
    const newPrompt = document.getElementById('avatarPromptInput').value;
    saveEmoticonInstruction(newPrompt);
    emoticonInstruction = newPrompt;
    $('#avatarPromptModal').modal('hide');
};

document.getElementById('resetAvatarPromptBtn').onclick = () => {
    document.getElementById('avatarPromptInput').value = defaultEmoticonInstruction;
};


/**
 * Loads the response length prompts from localStorage or returns defaults.
 * Ensures the returned array is valid and matches the expected length.
 * @returns {string[]} Array of response length prompt strings.
 */

function loadResponseLengthPrompts() {
    const stored = localStorage.getItem('bubbleai_response_length_prompts');
    if (stored) {
        try {
            const arr = JSON.parse(stored);
            // If not an array or empty, fallback to defaults
            if (!Array.isArray(arr) || arr.length !== defaultResponseLengthPresets.length) {
                return [...defaultResponseLengthPresets];
            }
            return arr;
        } catch {
            return [...defaultResponseLengthPresets];
        }
    }
    return [...defaultResponseLengthPresets];
}

/**
 * Loads the avatar/emoticon instruction prompt from localStorage or returns the default.
 * @returns {string} The avatar prompt string.
 */
function loadEmoticonInstruction() {
    return localStorage.getItem('bubbleai_emoticon_prompt') || defaultEmoticonInstruction;
}

/**
 * Saves the response length prompts to localStorage.
 * @param {string[]} prompts - Array of prompt strings to save.
 */
function saveResponseLengthPrompts(prompts) {
    localStorage.setItem('bubbleai_response_length_prompts', JSON.stringify(prompts));
}

/**
 * Saves the avatar/emoticon instruction prompt to localStorage.
 * @param {string} prompt - The prompt string to save.
 */
function saveEmoticonInstruction(prompt) {
    localStorage.setItem('bubbleai_emoticon_prompt', prompt);
}


// Handler for edit icon response Length prompts

/**
 * Displays a single message bubble in the chat
 * @param {string} message - The message text to display
 * @param {string} sender - Either 'user' or 'llm' to determine bubble style
 * @param {HTMLElement} chat - The chat container element
 * @param {boolean} pending - Whether the message is still pending (shows loading state)
 */
function displayMessage(message, sender, chat, pending = false) {
    if (!chat) {
        chat = document.getElementById('chatArea');
        if (!chat) {
            chat = document.createElement('div');
            chat.id = 'chatArea';
            chat.className = 'chat-area';
            document.querySelector('.col-sm-8.p-4').appendChild(chat);
        }
    }
    const msgDiv = document.createElement('div');
    msgDiv.className = 'bubble ' + (sender === 'user' ? 'bubble-user' : 'bubble-llm');


    if (pending) msgDiv.classList.add('bubble-pending');

    // Check the markdown toggle
    const markdownToggle = document.getElementById('markdownToggle');
    const markdownEnabled = markdownToggle ? markdownToggle.checked : true;

    if (sender === 'llm' && markdownEnabled) {
        msgDiv.innerHTML = marked.parse(message);
        msgDiv.querySelectorAll('pre code').forEach(block => {
            hljs.highlightElement(block);
        });
    } else {
        msgDiv.textContent = message;
    }

    // Just append in order; renderChatHistory handles order
    chat.appendChild(msgDiv);
}


// MODELS & PROVIDERS

let selectedProviderId = localStorage.getItem('bubbleai_selected_provider') || SUPPORTED_PROVIDERS[0].id;
let selectedProvider = SUPPORTED_PROVIDERS.find(p => p.id === selectedProviderId) || SUPPORTED_PROVIDERS[0];

/**
 * Renders the provider dropdown menu in the UI.
 */
function renderProviderDropdown() {
    const menu = document.getElementById('providerDropdownMenu');
    menu.innerHTML = SUPPORTED_PROVIDERS.map(provider => `
        <li>
            <a class="dropdown-item provider-dropdown-item${provider.id === selectedProviderId ? ' active' : ''}" 
                href="#" data-provider-id="${provider.id}">
                ${provider.name}
            </a>
        </li>
    `).join('');
    document.getElementById('currentProviderLabel').textContent = selectedProvider.name;
}

function updateProviderUI() {
    if (selectedProviderId === "gemini") {
        document.getElementById('geminiControls').style.display = '';
        document.getElementById('customControls').style.display = 'none';
    } else if (selectedProviderId === "custom") {
        document.getElementById('geminiControls').style.display = 'none';
        document.getElementById('customControls').style.display = '';
        updateCustomApiStatus();
    }
}


// Handle provider selection
document.getElementById('providerDropdownMenu').addEventListener('click', (e) => {
    const item = e.target.closest('a[data-provider-id]');
    if (!item) return;
    const providerId = item.getAttribute('data-provider-id');
    if (providerId !== selectedProviderId) {
        selectedProviderId = providerId;
        selectedProvider = SUPPORTED_PROVIDERS.find(p => p.id === providerId) || SUPPORTED_PROVIDERS[0];
        localStorage.setItem('bubbleai_selected_provider', providerId);
        renderProviderDropdown();
        updateProviderUI();
    }
});

document.getElementById('saveCustomApiBtn').addEventListener('click', () => {
    const endpoint = document.getElementById('customApiInput').value.trim();
    if (endpoint) {
        localStorage.setItem('bubbleai_custom_api_endpoint', endpoint);
        $('#customApiModal').modal('hide');
        updateCustomApiStatus();
    }
});


function updateCustomApiStatus() {
    const statusDiv = document.getElementById('customApiStatus');
    const endpoint = localStorage.getItem('bubbleai_custom_api_endpoint') || '';
    if (endpoint) {
        statusDiv.className = "alert alert-success p-2 my-2";
        statusDiv.innerHTML = `Custom API endpoint set <span style="font-size:0.9em;">(hidden)</span>
            <button class="btn btn-link btn-sm p-0" id="setCustomApiBtn">(Change)</button>`;
    } else {
        statusDiv.className = "alert alert-warning p-2 my-2";
        statusDiv.innerHTML = `No API endpoint set.
            <button class="btn btn-link btn-sm p-0" id="setCustomApiBtn">(Set Endpoint)</button>`;
    }
    document.getElementById('setCustomApiBtn').onclick = () => {
        document.getElementById('customApiInput').value = endpoint;
        $('#customApiModal').modal('show');
    };
}




/**
 * Renders the model dropdown menu in the UI.
 */
function renderModelDropdown() {
    const menu = document.getElementById('modelDropdownMenu');
    menu.innerHTML = SUPPORTED_MODELS.map(model => `
    <li>
        <a class="dropdown-item model-dropdown-item${model.id === selectedModelId ? ' active' : ''}" 
        href="#" data-model-id="${model.id}" 
        style="white-space:normal; font-size:1em; line-height:1.2; padding-top:0.6em; padding-bottom:0.6em;">
        ${model.name}
        </a>
    </li>
`).join('');
    document.getElementById('currentModelLabel').textContent = `${selectedModel.name}`;
}



// Handle selection
document.getElementById('modelDropdownMenu').addEventListener('click', (e) => {
    const item = e.target.closest('a[data-model-id]');
    if (!item) return;
    const modelId = item.getAttribute('data-model-id');
    if (modelId !== selectedModelId) {
        selectedModelId = modelId;
        selectedModel = getModelById(modelId);
        localStorage.setItem('bubbleai_selected_model', modelId);
        renderModelDropdown();
        // Re-initialize backend logic here if needed:
        initializeModel(selectedModel);
    }
});


document.getElementById('markdownToggle').addEventListener('change', () => {
    renderChatHistory();
    updateBubblesColWidth();
});

document.getElementById('toggleAvatar').addEventListener('change', () => {
    renderChatHistory();
});

/**
 * Toggles the sidebar open/closed and updates the UI.
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainArea = document.querySelector('.main-area');
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    sidebar.classList.toggle('sidebar-hidden');
    mainArea.classList.toggle('sidebar-collapsed');

    // Optionally flip the arrow icon
    const icon = toggleBtn.querySelector('i');
    if (sidebar.classList.contains('sidebar-hidden')) {
        icon.classList.remove('bi-arrow-left');
        icon.classList.add('bi-arrow-right');
        toggleBtn.title = "Show sidebar";
    } else {
        icon.classList.remove('bi-arrow-right');
        icon.classList.add('bi-arrow-left');
        toggleBtn.title = "Hide sidebar";
    }
}

document.getElementById('toggleSidebarBtn').addEventListener('click', toggleSidebar);


/**
 * Syncs a collapse arrow with its section.
 * @param {string} collapseId - The id of the collapsible div (e.g. "#providerSection")
 * @param {string} arrowSelector - The selector for the arrow span inside the toggle button
 */
function syncCollapseArrow(collapseId, arrowSelector) {
    var $collapse = $(collapseId);
    var arrow = document.querySelector(arrowSelector);
    if (!$collapse.length || !arrow) return;

    // Set initial state
    if ($collapse.hasClass('show')) {
        arrow.innerHTML = '&#9660;'; // ▼
    } else {
        arrow.innerHTML = '&#9654;'; // ▶
    }

    $collapse.on('show.bs.collapse', function () {
        arrow.innerHTML = '&#9660;'; // ▼
    });
    $collapse.on('hide.bs.collapse', function () {
        arrow.innerHTML = '&#9654;'; // ▶
    });
}


function setInitialCollapseState(sectionIds) {
    sectionIds.forEach(id => {
        const state = localStorage.getItem('bubbleui_' + id.replace('#', '') + '_open');
        const el = document.querySelector(id);
        if (!el) return;
        if (state === '0') {
            el.classList.remove('show');
        } else if (state === '1') {
            el.classList.add('show');
        }
    });
}


function persistCollapseState(sectionId) {
    const $collapse = $(sectionId);
    $collapse.on('show.bs.collapse', function () {
        localStorage.setItem('bubbleui_' + sectionId.replace('#', '') + '_open', '1');
    });
    $collapse.on('hide.bs.collapse', function () {
        localStorage.setItem('bubbleui_' + sectionId.replace('#', '') + '_open', '0');
    });
}

function restoreCollapseState(sectionId) {
    const state = localStorage.getItem('bubbleui_' + sectionId.replace('#', '') + '_open');
    const $collapse = $(sectionId);
    if (state === '0') {
        $collapse.collapse('hide');
    } else if (state === '1') {
        $collapse.collapse('show');
    }
}


function setupSidebarSections(sections) {
    sections.forEach(({ id, arrowSelector }) => {
        syncCollapseArrow(id, arrowSelector);
        restoreCollapseState(id);
        persistCollapseState(id);
    });
}




/**
 * Exports all app data (chats, contexts, response length prompts, emoticon prompt) as a single JSON file.
 * Reads from localStorage and triggers a download of bubbleui_data.json.
 * Useful for backup, migration, or sharing app state.
 */

document.getElementById('exportDataBtn').addEventListener('click', () => {
    const chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    const contexts = JSON.parse(localStorage.getItem('bubbleai_contexts') || '[]');
    const responseLengthPrompts = JSON.parse(localStorage.getItem('bubbleai_response_length_prompts') || 'null');
    const emoticonPrompt = localStorage.getItem('bubbleai_emoticon_prompt') || null;

    const exportObj = {
        chats,
        contexts,
        responseLengthPrompts,
        emoticonPrompt
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bubbleui_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});



document.addEventListener('DOMContentLoaded', function () {
    setInitialCollapseState([
        '#contextSection',
        '#chatsSection',
        '#settingsSection',
        '#providerModelSection'
    ]);
    document.getElementById('sidebar').style.visibility = 'visible';
    setupSidebarSections([
        { id: '#contextSection', arrowSelector: '[data-target="#contextSection"] .collapse-arrow' },
        { id: '#chatsSection', arrowSelector: '[data-target="#chatsSection"] .collapse-arrow' },
        { id: '#settingsSection', arrowSelector: '[data-target="#settingsSection"] .collapse-arrow' },
        { id: '#providerModelSection', arrowSelector: '[data-target="#providerModelSection"] .collapse-arrow' }
    ]);
    updateApiKeyStatus();
    initializeModel(selectedModel);
    updateSendBtn();
    renderChatHistory();
    updatePromptPosition();
    document.getElementById('saveChatBtn').addEventListener('click', saveCurrentChat);
    renderChatList();
    updateStorageMeter();
    updateBubblesColWidth();
    renderProviderDropdown();
    updateProviderUI();
    renderModelDropdown();
});

