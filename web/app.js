// Urban Trifts Support Desk chat. Plain JavaScript, no build step.
// Settings come from config.js (apiBase, accessKey).
(function () {
  var cfg = window.CHAT_CONFIG || {};
  var API = String(cfg.apiBase || "").trim().replace(/\/+$/, "");
  var KEY = String(cfg.accessKey || "").trim();

  var SHOE =
    '<svg class="shoe" viewBox="-10 0 76 40" aria-hidden="true">' +
    '<g class="whoosh"><path d="M-6 17h5M-9 23h6"/></g>' +
    '<g class="body">' +
    '<path class="upper" d="M5 29V15c0-2.5 2-4 4.5-3.2L15 13.5l2.5-7c.5-1 2-1.3 3.5-.9l3 1c.5 5.4 4.5 8.9 10 9.9 7 1.3 12 3.5 17 6.5 5.5 3.3 8.5 4.800 8.500 6.500z"/>' +
    '<path class="sole" d="M3.500 28.500H61V32c0 2.500-2 4.500-4.500 4.500H8c-2.500 0-4.500-2-4.500-4.500z"/>' +
    '<path class="stripe" d="M13 25.500c8-4 17-4.500 26-1.500"/>' +
    '<path class="lace" d="M18.500 16l4.500 2.800M22.500 13.500l5 3.200"/>' +
    "</g></svg>";

  var $ = function (id) { return document.getElementById(id); };
  var thread = $("thread"), welcome = $("welcome"), scroll = $("scroll");
  var input = $("input"), sendBtn = $("send"), notice = $("notice");
  var messages = [];
  var loading = false;
  var typingEl = null, errEl = null;

  document.querySelectorAll("[data-shoe]").forEach(function (el) { el.innerHTML = SHOE; });

  function toBottom() { scroll.scrollTop = scroll.scrollHeight; }

  function addMessage(role, text) {
    var row = document.createElement("div");
    row.className = "msg " + role;
    if (role === "assistant") {
      var av = document.createElement("div");
      av.className = "avatar";
      av.innerHTML = SHOE;
      row.appendChild(av);
    }
    var body = document.createElement("div");
    body.className = "body";
    body.textContent = text; // textContent keeps AI output safe
    row.appendChild(body);
    thread.appendChild(row);
    toBottom();
    return row;
  }

  function showTyping() {
    typingEl = document.createElement("div");
    typingEl.className = "msg assistant walking";
    typingEl.innerHTML = '<div class="avatar">' + SHOE + '</div><div class="body"><span class="dots"><i></i><i></i><i></i></span></div>';
    thread.appendChild(typingEl);
    toBottom();
  }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }
  function clearError() { if (errEl) { errEl.remove(); errEl = null; } }

  function showError(text, canRetry) {
    clearError();
    errEl = document.createElement("div");
    errEl.className = "err";
    errEl.setAttribute("role", "alert");
    var span = document.createElement("span");
    span.textContent = text;
    errEl.appendChild(span);
    if (canRetry) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "Try again";
      b.onclick = function () { requestReply(); };
      errEl.appendChild(b);
    }
    thread.appendChild(errEl);
    toBottom();
  }

  function setLoading(v) {
    loading = v;
    input.disabled = v;
    updateSend();
  }
  function updateSend() { sendBtn.disabled = loading || input.value.trim() === ""; }

  async function requestReply() {
    setLoading(true);
    clearError();
    showTyping();
    try {
      var res;
      try {
        var headers = { "Content-Type": "application/json" };
        if (KEY) headers["x-chat-key"] = KEY;
        res = await fetch(API + "/api/chat", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ messages: messages }),
        });
      } catch (e) {
        throw new Error("I can't reach the chat server. Check that the server and the tunnel are running, and that config.js has the right address.");
      }
      var data = {};
      try { data = await res.json(); } catch (e) { /* not JSON */ }
      if (!res.ok) throw new Error(data.message || "Something went wrong. Please try again.");
      notice.hidden = true;
      messages.push({ role: "assistant", content: data.reply });
      hideTyping();
      addMessage("assistant", data.reply);
    } catch (err) {
      hideTyping();
      showError(err.message, true);
    } finally {
      setLoading(false);
      input.focus();
    }
  }

  function send(text) {
    text = String(text || "").trim();
    if (!text || loading) return;
    if (welcome) { welcome.remove(); welcome = null; }
    messages.push({ role: "user", content: text });
    addMessage("user", text);
    input.value = "";
    autosize();
    updateSend();
    requestReply();
  }

  function newChat() {
    if (loading) return;
    messages = [];
    clearError();
    thread.innerHTML = "";
    var w = document.createElement("div");
    w.className = "welcome";
    w.id = "welcome";
    w.innerHTML = '<span class="logo big">' + SHOE + '</span><h1>How can I help you today?</h1>';
    thread.appendChild(w);
    welcome = w;
    input.focus();
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 200) + "px";
  }

  $("form").addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener("input", function () { autosize(); updateSend(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
  });
  $("newChat").addEventListener("click", newChat);
  $("newChatMobile").addEventListener("click", newChat);
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-p]");
    if (t) send(t.getAttribute("data-p"));
  });

  // Check that the server and Ollama are ready when the page opens.
  (async function health() {
    try {
      var r = await fetch(API + "/api/health");
      var d = await r.json();
      if (!d.ollamaRunning) {
        notice.textContent = "Ollama doesn't seem to be running. Open the Ollama app (or run 'ollama serve'), then start chatting.";
        notice.hidden = false;
      } else if (!d.modelInstalled) {
        notice.textContent = 'The AI model "' + d.model + '" isn\'t installed yet. Run in a terminal: ollama pull ' + d.model;
        notice.hidden = false;
      }
    } catch (e) {
      notice.textContent = "I can't reach the chat server. Start it with 'npm start' in the server folder and check config.js.";
      notice.hidden = false;
    }
  })();

  updateSend();
})();
