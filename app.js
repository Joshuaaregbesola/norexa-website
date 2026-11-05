const $ = (id) => document.getElementById(id);
const API_BASE = (window.NEXORA_CONFIG?.API_BASE_URL || "").replace(/\/$/, "");
const STORAGE_KEY = "nexora_chats_v1";
let chats = loadChats();
let activeId = chats[0]?.id || null;
let pendingFile = null;
let busy = false;
let recognition = null;

function loadChats() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveChats() { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 40))); }
function makeId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function activeChat() { return chats.find(c => c.id === activeId); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function formatText(s) {
  // Minimal safe formatting: escape HTML, then support paragraphs and inline code.
  return escapeHtml(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
}
function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
}
function createChat() {
  const chat = { id: makeId(), title: "New conversation", messages: [], updatedAt: Date.now() };
  chats.unshift(chat); activeId = chat.id; saveChats(); renderAll(); $("messageInput").focus();
}
function renderHistory() {
  const list = $("historyList"); list.innerHTML = "";
  chats.forEach(chat => {
    const b = document.createElement("button"); b.className = "history-item" + (chat.id === activeId ? " active" : "");
    b.textContent = chat.title; b.title = chat.title;
    b.onclick = () => { activeId = chat.id; renderAll(); $("sidebar").classList.remove("open"); };
    list.appendChild(b);
  });
}
function renderMessages() {
  const chat = activeChat();
  const hasMessages = !!chat?.messages.length;
  $("welcome").hidden = hasMessages;
  $("messages").innerHTML = "";
  if (!chat) return;
  chat.messages.forEach(msg => {
    const row = document.createElement("div"); row.className = "message-row " + msg.role;
    const avatar = document.createElement("div"); avatar.className = "message-avatar " + (msg.role === "assistant" ? "ai" : "user");
    avatar.textContent = msg.role === "assistant" ? "N" : "Y";
    const body = document.createElement("div"); body.className = "message-body";
    const who = document.createElement("div"); who.className = "message-who"; who.textContent = msg.role === "assistant" ? "NEXORA" : "YOU";
    const text = document.createElement("div"); text.className = "message-text"; text.innerHTML = formatText(msg.content);
    body.append(who, text);
    if (msg.attachmentName) {
      const file = document.createElement("div"); file.className = "message-file"; file.textContent = "▧ " + msg.attachmentName; body.appendChild(file);
    }
    if (msg.role === "assistant" && msg.content) {
      const actions = document.createElement("div"); actions.className = "message-actions";
      const copy = document.createElement("button"); copy.textContent = "Copy"; copy.onclick = () => navigator.clipboard?.writeText(msg.content).then(() => toast("Copied")).catch(() => toast("Could not copy"));
      const speak = document.createElement("button"); speak.textContent = "Read aloud"; speak.onclick = () => speakText(msg.content);
      actions.append(copy, speak); body.appendChild(actions);
    }
    row.append(avatar, body); $("messages").appendChild(row);
  });
  $("messages").scrollTop = $("messages").scrollHeight;
}
function renderAll() { renderHistory(); renderMessages(); }
function setBusy(value) {
  busy = value; $("sendBtn").disabled = value; $("sendBtn").textContent = value ? "…" : "↑";
}
function setFile(file) {
  if (!file) return;
  if (file.size > 12 * 1024 * 1024) { toast("Please choose a file under 12 MB."); return; }
  const isImage = file.type.startsWith("image/");
  const allowed = isImage || /\.(pdf|txt|md|csv|json|doc|docx|rtf|odt|ppt|pptx|xls|xlsx)$/i.test(file.name);
  if (!allowed) { toast("That file type isn't supported."); return; }
  pendingFile = file;
  $("attachmentPreview").hidden = false;
  $("attachmentPreview").innerHTML = `<span>📎 ${escapeHtml(file.name)}</span><button type="button" id="removeFile" aria-label="Remove attachment">×</button>`;
  $("removeFile").onclick = clearFile;
}
function clearFile() { pendingFile = null; $("fileInput").value = ""; $("attachmentPreview").hidden = true; $("attachmentPreview").innerHTML = ""; }
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
}
async function sendMessage(textOverride) {
  if (busy) return;
  const text = (textOverride ?? $("messageInput").value).trim();
  if (!text && !pendingFile) return;
  if (!activeChat()) createChat();
  const chat = activeChat();
  const file = pendingFile;
  const userMessage = { role: "user", content: text || (file?.type.startsWith("image/") ? "Please describe this image." : "Please analyze this document."), attachmentName: file?.name || "" };
  chat.messages.push(userMessage);
  if (chat.messages.length === 1) chat.title = (text || file?.name || "New conversation").slice(0, 36);
  chat.updatedAt = Date.now(); saveChats(); clearFile(); $("messageInput").value = ""; resizeInput(); renderAll(); setBusy(true);
  const typing = document.createElement("div"); typing.className = "typing"; typing.id = "typing"; typing.innerHTML = '<span></span><span></span><span></span><small>NEXORA is thinking</small>';
  $("messages").appendChild(typing); $("messages").scrollTop = $("messages").scrollHeight;
  try {
    const payload = {
      messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
      language: $("languageSelect").value
    };
    if (file) payload.attachment = { name: file.name, mime: file.type || "application/octet-stream", dataUrl: await fileAsDataUrl(file) };
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    chat.messages.push({ role: "assistant", content: data.reply || "I couldn't create a reply." });
    chat.updatedAt = Date.now(); saveChats();
  } catch (err) {
    chat.messages.push({ role: "assistant", content: `I couldn't connect just now. ${err.message}\n\nPlease check your connection and try again.` });
    saveChats();
  } finally {
    $("typing")?.remove(); setBusy(false); renderAll();
  }
}
function resizeInput() {
  const el = $("messageInput"); el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px";
}
function speakText(text) {
  if (!("speechSynthesis" in window)) return toast("Read aloud isn't supported in this browser.");
  window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); window.speechSynthesis.speak(utterance);
}
function setupVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { $("voiceBtn").title = "Voice input isn't supported in this browser"; return; }
  recognition = new SpeechRecognition(); recognition.interimResults = true; recognition.continuous = false;
  recognition.onresult = e => {
    let transcript = ""; for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript;
    $("messageInput").value = transcript; resizeInput();
  };
  recognition.onerror = () => { $("voiceBtn").classList.remove("recording"); toast("Microphone input stopped. Check browser permission."); };
  recognition.onend = () => $("voiceBtn").classList.remove("recording");
  $("voiceBtn").onclick = () => {
    try {
      if ($("voiceBtn").classList.contains("recording")) recognition.stop();
      else { recognition.lang = "en-NG"; recognition.start(); $("voiceBtn").classList.add("recording"); }
    } catch { toast("Couldn't start the microphone. Try again."); }
  };
}
$("chatForm").addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
$("messageInput").addEventListener("input", resizeInput);
$("messageInput").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
$("newChatBtn").onclick = createChat;
$("attachBtn").onclick = () => $("fileInput").click();
$("fileInput").onchange = e => setFile(e.target.files?.[0]);
$("clearHistoryBtn").onclick = () => {
  if (confirm("Delete all NEXORA chat history saved on this device?")) { chats = []; activeId = null; localStorage.removeItem(STORAGE_KEY); createChat(); }
};
$("menuBtn").onclick = () => $("sidebar").classList.toggle("open");
document.querySelectorAll(".suggestion").forEach(b => b.onclick = () => sendMessage(b.dataset.prompt));
if (!activeId) createChat(); else renderAll();
setupVoice();
