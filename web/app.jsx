// Generated from client/ChatPanel.jsx for the built-in starter page.
// If you change ChatPanel.jsx, copy the changes here too.
const { useState, useRef, useEffect } = React;
// Urban Trifts Support Desk - AI chat panel
// A self-contained React component. Drop it into any page of the dashboard:
//
//   import ChatPanel from "./ChatPanel";
//   ...
//   <ChatPanel />
//
// It only needs React (hooks). No extra libraries.


// Default address of the Express chat server (your own computer).
// When deployed, pass the tunnel address instead:
//   <ChatPanel apiBase="https://your-tunnel.trycloudflare.com" accessKey="your-key" />
const DEFAULT_API_BASE = "http://localhost:3001";

const WELCOME_TEXT =
  "Hi there! I'm the Urban Trifts Support Assistant. How can I help you today?";

function ChatPanel({ apiBase = DEFAULT_API_BASE, accessKey = "" }) {
  const API_BASE = apiBase.replace(/\/$/, "");
  const [messages, setMessages] = useState([]); // [{ role: "user" | "assistant", content }]
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // text shown under the messages
  const [notice, setNotice] = useState(null); // setup problem shown at the top
  const bottomRef = useRef(null);

  // On first load, check that the server and Ollama are ready.
  useEffect(() => {
    let cancelled = false;
    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.ollamaRunning) {
          setNotice(
            "Ollama doesn't seem to be running. Open the Ollama app (or run 'ollama serve') and then try chatting."
          );
        } else if (!data.modelInstalled) {
          setNotice(
            `The AI model "${data.model}" isn't installed yet. Run this in a terminal: ollama pull ${data.model}`
          );
        }
      } catch {
        if (!cancelled) {
          setNotice(
            "I can't reach the chat server. Start it by running 'npm start' in the server folder."
          );
        }
      }
    }
    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading, error]);

  // Sends the whole conversation so the AI can follow up on earlier details.
  async function requestReply(history) {
    setLoading(true);
    setError(null);
    try {
      let res;
      try {
        res = await fetch(`${API_BASE}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessKey ? { "x-chat-key": accessKey } : {}),
          },
          body: JSON.stringify({ messages: history }),
        });
      } catch {
        throw new Error(
          "I can't reach the chat server. Make sure it's running ('npm start' in the server folder)."
        );
      }

      let data = {};
      try {
        data = await res.json();
      } catch {
        /* response wasn't JSON */
      }
      if (!res.ok) {
        throw new Error(data.message || "Something went wrong. Please try again.");
      }

      setNotice(null); // it worked, so any earlier setup warning is out of date
      setMessages([...history, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    requestReply(history);
  }

  function handleKeyDown(e) {
    // Enter sends, Shift+Enter makes a new line.
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleNewChat() {
    if (loading) return;
    setMessages([]);
    setError(null);
    setInput("");
  }

  const canRetry = error && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <section className="ut-chat" aria-label="Urban Trifts AI support chat">
      <header className="ut-chat__header">
        <div>
          <h2 className="ut-chat__title">Support Assistant</h2>
          <p className="ut-chat__subtitle">Urban Trifts AI helper</p>
        </div>
        <button
          type="button"
          className="ut-chat__link-button"
          onClick={handleNewChat}
          disabled={loading || messages.length === 0}
        >
          New chat
        </button>
      </header>

      {notice && (
        <div className="ut-chat__notice" role="alert">
          {notice}
        </div>
      )}

      <div className="ut-chat__messages" aria-live="polite">
        <div className="ut-chat__row ut-chat__row--assistant">
          <div className="ut-chat__bubble ut-chat__bubble--assistant">{WELCOME_TEXT}</div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className={`ut-chat__row ut-chat__row--${m.role}`}>
            <div className={`ut-chat__bubble ut-chat__bubble--${m.role}`}>{m.content}</div>
          </div>
        ))}

        {loading && (
          <div className="ut-chat__row ut-chat__row--assistant">
            <div className="ut-chat__bubble ut-chat__bubble--assistant ut-chat__typing" aria-label="The assistant is typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && (
          <div className="ut-chat__error" role="alert">
            <span>{error}</span>
            {canRetry && (
              <button
                type="button"
                className="ut-chat__link-button"
                onClick={() => requestReply(messages)}
                disabled={loading}
              >
                Try again
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="ut-chat__composer">
        <textarea
          className="ut-chat__input"
          rows={2}
          placeholder="Type your question and press Enter..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          maxLength={4000}
        />
        <button
          type="button"
          className="ut-chat__send"
          onClick={handleSend}
          disabled={loading || input.trim() === ""}
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ChatPanel apiBase={window.CHAT_CONFIG.apiBase} accessKey={window.CHAT_CONFIG.accessKey} />
);
