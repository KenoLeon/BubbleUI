import { GoogleGenerativeAI } from "@google/generative-ai";

import { marked } from "marked";
import hljs from "highlight.js";

// import { GEMINI_API_KEY } from './apikey.js';
// const ai = new GoogleGenerativeAI(GEMINI_API_KEY);


let ai = null;
const textArea = document.getElementById('textArea');
const sendBtn = document.getElementById('sendBtn');
let tabHeld = false;
const responseLengthOptions = ['Default', 'Short', 'Medium', 'Long', 'Full'];
const responseLength = document.getElementById('responseLength');
const responseLengthLabel = document.getElementById('responseLengthLabel');
const addContextBtn = document.getElementById('addContextBtn');
const saveContextBtn = document.getElementById('saveContextBtn');
const contextText = document.getElementById('contextText');
const contextFile = document.getElementById('contextFile');

const responseLengthPresets = [
    "",
    "Answer in as few words or sentences as possible.",
    "Answer in a medium length, a few sentences.",
    "Answer in a long, detailed paragraph.",
    "Answer in a full, comprehensive and elaborate response."
];


let sortOrder = localStorage.getItem('bubbleai_sort_order') || 'recent';
document.getElementById('sortOrderLabel').textContent = sortOrder === 'recent' ? 'Recent' : 'Oldest';
let promptPosition = localStorage.getItem('bubbleai_prompt_position') || 'top'; // or 'bottom'
let chatHistory = [];
let activeChatId = null;



document.getElementById('darkModeToggle').addEventListener('change', function() {
    document.body.classList.toggle('dark-theme', this.checked);    
    localStorage.setItem('bubbleai_dark_mode', this.checked ? '1' : '0');
});

if (localStorage.getItem('bubbleai_dark_mode') === '1') {
    document.getElementById('darkModeToggle').checked = true;
    document.body.classList.add('dark-theme');
}

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


// KEYS KEYS KEYS

function getApiKey() {
    return localStorage.getItem('bubbleai_api_key') || '';
}

function setApiKey(key) {
    localStorage.setItem('bubbleai_api_key', key);
    updateStorageMeter();
}



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
        initializeGemini();
    }
});

// PROVIDER MODEL MANAGEMENT:
function initializeGemini() {
    const key = getApiKey();
    if (key) {
        ai = new GoogleGenerativeAI(key);
    }
}

// LOCAL STORAGE:

function loadContextsFromStorage() {
    const data = localStorage.getItem('bubbleai_contexts');
    return data ? JSON.parse(data) : [];
}

function getLocalStorageSizeMB() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += ((localStorage[key].length + key.length) * 2); // 2 bytes per char
        }
    }
    return total / (1024 * 1024); // MB
}


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


function saveContextsToStorage() {
    localStorage.setItem('bubbleai_contexts', JSON.stringify(contexts));
    updateStorageMeter();
}

function clearAppStorage() {
    localStorage.removeItem('bubbleai_contexts');
    localStorage.removeItem('bubbleai_api_key');
    location.reload();
    updateStorageMeter();
}


document.getElementById('clearAppDataBtn').addEventListener('click', clearAppStorage);

// HELPER FUNCTIONS:

function setSortOrder(newOrder) {
    sortOrder = newOrder;
    localStorage.setItem('bubbleai_sort_order', sortOrder);
    document.getElementById('sortOrderLabel').textContent = sortOrder === 'recent' ? 'Recent' : 'Oldest';
}


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

function removePromptLoadingBubble() {
    const container = document.getElementById('loadingBubblePrompt');
    if (container) container.innerHTML = '';
}



// CHAT HISTORY MANAGEMENT:

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


// SAVE CHAT FUNCTIONALITY:

function saveCurrentChat() {
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    const name = prompt('Name this chat:', `Chat ${chats.length + 1}`);
    if (!name) return;
    const id = Date.now();
    chats.push({
        id,
        name,
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

function renderChatList() {
    const chatListDiv = document.getElementById('chatList');
    chatListDiv.innerHTML = '';
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    chats.forEach((chat, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center mb-1';

        // Chat select button
        const btn = document.createElement('button');
        btn.className = 'btn btn-block btn-sm text-left chat-list-btn flex-grow-1';
        btn.textContent = chat.name || `Chat ${idx + 1}`;
        btn.title = `Saved: ${chat.created ? new Date(chat.created).toLocaleString() : ''}`;
        if (chat.id === activeChatId) {
            btn.classList.add('active');
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
        editBtn.title = 'Rename this chat';
        editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            renameChat(idx);
        };

        wrapper.appendChild(btn);
        wrapper.appendChild(editBtn);
        wrapper.appendChild(deleteBtn);
        chatListDiv.appendChild(wrapper);
    });
}

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


function renameChat(idx) {
    let chats = JSON.parse(localStorage.getItem('bubbleai_chats') || '[]');
    if (!chats[idx]) return;
    const newName = prompt('Rename chat:', chats[idx].name || `Chat ${idx + 1}`);
    if (newName && newName.trim()) {
        chats[idx].name = newName.trim();
        localStorage.setItem('bubbleai_chats', JSON.stringify(chats));
        renderChatList();
    }
}

document.getElementById('addChatBtn').addEventListener('click', () => {
    chatHistory = [];
    activeChatId = null;
    contexts.forEach(ctx => ctx.active = false);
    saveContextsToStorage();
    renderContextList();

    // Set default width for new chat
    const defaultWidth = 80;
    chatWidthSlider.value = defaultWidth;
    chatWidthLabel.textContent = defaultWidth + '%';


    renderChatHistory();
    renderChatList();
    updateBubblesColWidth();
});


// Chat Width

const chatWidthSlider = document.getElementById('chatWidthSlider');
const chatWidthLabel = document.getElementById('chatWidthLabel');

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
window.renderChatHistory = function() {
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


function renderContextList() {
    const contextList = document.getElementById('contextList');
    contextList.innerHTML = '';
    contexts.forEach((ctx, idx) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex align-items-center mb-1';

        // Context label
        const label = document.createElement('span');
        label.textContent = ctx.title || `Context ${idx + 1}`;
        label.className = 'flex-grow-1 context-title' + (ctx.active ? ' active' : '');

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
    });
}

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
        $('#inspectContextModal').modal('hide');
        editingContextIdx = null;
    }
});


$('#inspectContextModal').on('hidden.bs.modal', function () {
    editingContextIdx = null;
});

// CONTEXT BLOCK



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
    document.getElementById('chatMemoryContent').textContent = chatMemory || "(No chat memory yet)";
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
    let fullPrompt = `${contextBlock}${prePrompt}\n\n`;
    if (chatHistoryEnabled && historyBlock) {
        fullPrompt += `${historyBlock}\n`;
    }
    fullPrompt += `User: ${text}`;

    // 6. Show the loading indicator
    showPromptLoadingBubble();

    // 7. Call the model and handle the response
    try {
        const model = ai.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(fullPrompt);
        removePromptLoadingBubble();

        // Unmark pending for the last user prompt
        for (let i = chatHistory.length - 1; i >= 0; i--) {
            if (chatHistory[i].role === 'user' && chatHistory[i].pending) {
                chatHistory[i].pending = false;
                break;
            }
        }

        // Add the LLM response and re-render
        chatHistory.push({ role: 'llm', text: result.response.text() });
        renderChatHistory();
        updateBubblesColWidth();
        updateActiveChatInStorage();
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
        if (aiMsg) {
            displayMessage(aiMsg.text, 'llm', bubblesCol);
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

document.getElementById('markdownToggle').addEventListener('change', () => {
    renderChatHistory();
    updateBubblesColWidth();
});


document.addEventListener('DOMContentLoaded', function () {
    updateApiKeyStatus();
    initializeGemini();
    updateSendBtn();
    renderChatHistory();
    updatePromptPosition();
    document.getElementById('saveChatBtn').addEventListener('click', saveCurrentChat);
    renderChatList();    
    updateStorageMeter();
    updateBubblesColWidth();
});

