// Urban Trifts Support Desk - AI chat backend
// A small Express server that forwards chat messages to a local Ollama model.
// No database, no API keys, no cost.

const express = require("express");
const path = require("path");
const cors = require("cors");

// ---- Settings (override with environment variables if you like) ----
const PORT = process.env.PORT || 3001;
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const MAX_HISTORY_MESSAGES = 20; // how many recent messages the AI "remembers"
const MAX_MESSAGE_CHARS = 4000; // longest single message we accept
const TIMEOUT_MS = 120000; // give the model up to 2 minutes (first reply can be slow)

// ---- The AI's personality ----
const SYSTEM_PROMPT = `You are the Urban Trifts Support Assistant, a friendly and professional customer support helper for Urban Trifts.

IMPORTANT LIMITS (never break these):
- You have NO access to orders, tracking, inventory, accounts, prices, or company policies. You cannot look anything up or "check" anything.
- NEVER say or imply that you checked, looked up, found, or verified anything. Never state an order status, shipping date, delivery estimate, refund status, price, or policy.
- If asked about an order, return, refund, or delivery: collect the details (name, order number, what happened), say plainly that you cannot see live order information, and offer to pass the details to a human teammate who can.

How you behave:
- Be warm, polite, and clear. Keep replies short: 2 to 4 sentences. Ask only one question at a time.
- Remember details the customer gives you earlier in the conversation (name, order number, product, issue) and use them in later replies.
- If a customer seems upset, apologize sincerely first, then help.
- Never ask for passwords or full payment card numbers.

Example of the right behavior:
Customer: My order UT-1001 hasn't arrived.
You: I'm sorry your order is late. I can't see live order or tracking details from this chat, so I don't want to guess. Would you like me to pass order UT-1001 to a teammate who can look into it?
Customer: Yes.
You: Done. I've noted order UT-1001 for a teammate to review. Is there anything else I can help with?`;
const app = express();

// Allow the React dashboard to call this server.
// localhost is always allowed. For a deployed dashboard (e.g. on Vercel), list its
// address in ALLOWED_ORIGINS, separated by commas, with no trailing slash.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) =>
      callback(null, !origin || LOCAL_ORIGIN.test(origin) || EXTRA_ORIGINS.includes(origin)),
  })
);
app.use(express.json({ limit: "200kb" }));

// Serves the built-in starter page at http://localhost:3001
app.use(express.static(path.join(__dirname, "public")));

// Optional shared password. If CHAT_ACCESS_KEY is set, every chat request must send it.
const ACCESS_KEY = process.env.CHAT_ACCESS_KEY || "";
function requireKey(req, res, next) {
  if (ACCESS_KEY && req.get("x-chat-key") !== ACCESS_KEY) {
    return res.status(401).json({
      error: "unauthorized",
      message: "This chat needs a valid access key. Please check the key with your administrator.",
    });
  }
  next();
}

// Checks the request body and returns a clean list of messages (or throws).
function cleanMessages(body) {
  const raw = body && body.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("Please send a non-empty 'messages' list.");
  }
  const messages = raw.map((m) => {
    if (!m || (m.role !== "user" && m.role !== "assistant")) {
      throw new Error("Each message needs a role of 'user' or 'assistant'.");
    }
    if (typeof m.content !== "string" || m.content.trim() === "") {
      throw new Error("Each message needs some text content.");
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      throw new Error(`Messages must be under ${MAX_MESSAGE_CHARS} characters.`);
    }
    return { role: m.role, content: m.content.trim() };
  });
  if (messages[messages.length - 1].role !== "user") {
    throw new Error("The last message must be from the user.");
  }
  // Keep only the most recent messages so the model stays fast and in budget.
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

// ---- Health check: is Ollama running, and is the model installed? ----
app.get("/api/health", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await r.json();
    const names = (data.models || []).map((m) => m.name);
    const modelInstalled = names.some(
      (n) => n === MODEL || n.startsWith(`${MODEL}:`)
    );
    res.json({ ok: modelInstalled, ollamaRunning: true, modelInstalled, model: MODEL });
  } catch {
    res.json({ ok: false, ollamaRunning: false, modelInstalled: false, model: MODEL });
  }
});

// ---- Chat ----
app.post("/api/chat", requireKey, async (req, res) => {
  let messages;
  try {
    messages = cleanMessages(req.body);
  } catch (err) {
    return res.status(400).json({ error: "bad_request", message: err.message });
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        options: { temperature: 0.3 }, // calmer, less made-up answers
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json()).error || "";
      } catch {
        /* ignore */
      }
      if (response.status === 404) {
        return res.status(404).json({
          error: "model_not_found",
          message: `The AI model "${MODEL}" isn't installed yet. Open a terminal and run: ollama pull ${MODEL}`,
        });
      }
      console.error("Ollama error:", response.status, detail);
      return res.status(502).json({
        error: "ollama_error",
        message: "The AI model returned an error. Please try again.",
      });
    }

    const data = await response.json();
    const reply = data && data.message && data.message.content;
    if (!reply) {
      return res.status(502).json({
        error: "empty_reply",
        message: "The AI sent back an empty answer. Please try again.",
      });
    }
    res.json({ reply: reply.trim() });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return res.status(504).json({
        error: "timeout",
        message: "The AI took too long to answer. Please try again, or try a shorter question.",
      });
    }
    // fetch() throws a TypeError when it cannot connect at all.
    console.error("Could not reach Ollama:", err.cause ? err.cause.code : err.message);
    res.status(503).json({
      error: "ollama_not_running",
      message:
        "I can't reach the AI right now. Make sure Ollama is running (open the Ollama app, or run 'ollama serve' in a terminal).",
    });
  }
});

// Only start listening when run directly (so tests can import the app).
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Urban Trifts chat server running at http://localhost:${PORT}`);
    console.log(`Using Ollama at ${OLLAMA_URL} with model "${MODEL}"`);
  });
}

module.exports = { app, SYSTEM_PROMPT };
