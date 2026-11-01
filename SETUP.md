# Urban Trifts Support Desk: AI Chat Setup

A free AI chat that runs entirely on your own computer. No account, no API key, no subscription.

```
React dashboard  -->  Express server (port 3001)  -->  Ollama (port 11434)  -->  AI model
  ChatPanel.jsx         server/server.js                runs on your PC
```

## What you need

- **Node.js 18 or newer.** Check with `node -v` in a terminal. Get it from https://nodejs.org if needed.
- **About 4 GB of free disk space** and **8 GB of RAM** (the model below is small).

---

## Step 1: Install Ollama

1. Go to https://ollama.com/download and install the version for your system (Windows, macOS or Linux).
2. After installing, Ollama runs in the background. On Windows and Mac you'll see its icon in the system tray / menu bar.

## Step 2: Download the free AI model

Open a terminal (Command Prompt, PowerShell or Terminal) and run:

```
ollama pull llama3.2
```

This downloads **Llama 3.2 (3B)**, a free model of about 2 GB. It's fast on ordinary laptops and good for support-style conversations. This only needs doing once.

Quick check that it works (type `/bye` to leave):

```
ollama run llama3.2
```

**Other free options** (change the model with the `OLLAMA_MODEL` setting in Step 4):

| Your computer | Model | Command |
| --- | --- | --- |
| Older or low-memory (4 GB RAM) | `llama3.2:1b` (smaller, less clever) | `ollama pull llama3.2:1b` |
| Recommended | `llama3.2` | `ollama pull llama3.2` |
| Powerful (16 GB RAM or more) | `llama3.1:8b` (better answers, slower) | `ollama pull llama3.1:8b` |

## Step 3: Install the chat server

In a terminal, go to the `server` folder of this project and install its packages:

```
cd urban-trifts-chat/server
npm install
```

## Step 4: Start the chat server

```
npm start
```

You should see: `Urban Trifts chat server running at http://localhost:3001`

Leave this terminal window open while you use the chat.

To use a different model, set `OLLAMA_MODEL` before starting:

- Windows PowerShell: `$env:OLLAMA_MODEL="llama3.2:1b"; npm start`
- Mac / Linux: `OLLAMA_MODEL=llama3.2:1b npm start`

Check that everything is connected by opening http://localhost:3001/api/health in your browser. You want to see `"ok":true`.

## Step 5: Add the chat to your React dashboard

1. Copy `client/ChatPanel.jsx` and `client/ChatPanel.css` into your dashboard's `src` folder (or a components folder).
2. Show it on any page:

```jsx
import ChatPanel from "./ChatPanel";

function SupportPage() {
  return (
    <div>
      {/* ...your existing dashboard content... */}
      <ChatPanel />
    </div>
  );
}
```

3. Start your dashboard the way you normally do (for example `npm run dev` or `npm start`).

To match your brand, change `--ut-chat-accent` at the top of `ChatPanel.css`.

## Each time you want to use it

1. Make sure **Ollama is running** (the tray icon is there).
2. Start the chat server: `npm start` inside `server`.
3. Start your dashboard.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| "Ollama doesn't seem to be running" | Open the Ollama app, or run `ollama serve` in a terminal. |
| "The AI model isn't installed yet" | Run `ollama pull llama3.2`. |
| "I can't reach the chat server" | Start the server (`npm start` in the `server` folder). |
| The first answer is very slow | Normal. The model loads into memory the first time. Later answers are faster. |
| Answers are slow overall | Try the smaller model `llama3.2:1b`. |
| "Port 3001 already in use" | Start with another port: `PORT=3002 npm start`, then change `API_BASE` at the top of `ChatPanel.jsx`. |

## Deploying online

See DEPLOY.md for putting the dashboard on Vercel.

## Run the tests (optional)

```
cd server
npm test
```

The tests use a pretend Ollama, so they don't need the real model.

## How it works

- **Memory:** the dashboard sends the whole conversation each time, and the server passes the latest 20 messages to the model, so follow-up questions work. Clicking **New chat** (or refreshing the page) starts fresh. Nothing is saved to disk.
- **Personality:** edit `SYSTEM_PROMPT` near the top of `server/server.js` to change the assistant's tone or add rules. The assistant is told it cannot see orders, prices or policies, and must hand those questions to a human.
- **Privacy:** everything stays on your computer.

---

## Deploying the dashboard (Vercel) while Ollama stays on your PC

The dashboard can live on Vercel. The AI keeps running on your PC, so it only works while that PC is on, awake and online with Ollama, the chat server and the tunnel all running.

1. **Pick an access key** (any long random text) and start the chat server with your Vercel address allowed:
   - Windows PowerShell: `$env:ALLOWED_ORIGINS="https://your-dashboard.vercel.app"; $env:CHAT_ACCESS_KEY="your-long-key"; npm start`
   - Mac / Linux: `ALLOWED_ORIGINS=https://your-dashboard.vercel.app CHAT_ACCESS_KEY=your-long-key npm start`
2. **Start a free tunnel** (install `cloudflared` from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/):
   `cloudflared tunnel --url http://localhost:3001`
   It prints an address like `https://something.trycloudflare.com`. The free quick tunnel gets a new address each time you restart it.
3. **Point the dashboard at the tunnel** by passing it to the component:
   ```jsx
   <ChatPanel apiBase="https://something.trycloudflare.com" accessKey="your-long-key" />
   ```
   Better, read both from environment variables on Vercel (Vite: `import.meta.env.VITE_CHAT_API` and `VITE_CHAT_KEY`; Create React App: `process.env.REACT_APP_CHAT_API` and `REACT_APP_CHAT_KEY`).
4. Redeploy on Vercel. Open the Vercel link from another computer to test.

Note: the access key placed in a front-end app is visible to anyone who can open the dashboard in a browser, so it keeps strangers out but is not real login security. For public customer use, add proper login or use a hosted AI service instead.

---

## Quick start without a dashboard

The server includes a simple Support Desk dashboard page with the chat on it. Run `npm start` in the `server` folder, then open **http://localhost:3001** in your browser to chat. It needs an internet connection the first time to load React.
