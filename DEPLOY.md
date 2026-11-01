# Deploy the dashboard on Vercel (free)

The dashboard (`web` folder) goes on Vercel. The AI keeps running on your PC and Vercel reaches it through a free Cloudflare tunnel.
It only works while your PC is on, awake and online with Ollama, the chat server and the tunnel all running.

## Part A: Start the AI side on your PC

1. Open Ollama (llama icon near the clock). Model `llama3.2` must be downloaded.
2. Install cloudflared (free): https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
   On Windows, `winget install --id Cloudflare.cloudflared` in Command Prompt also works.
3. Start the tunnel in a NEW Command Prompt window and leave it open:
   ```
   cloudflared tunnel --url http://localhost:3001
   ```
   Copy the address it prints, like `https://random-words.trycloudflare.com`.
4. You will give the server your Vercel address in Part C, so keep this tunnel window open for now.

## Part B: Put the dashboard on GitHub and Vercel

1. Create a free account at https://github.com and make a new repository (for example `urban-trifts-support-desk`).
2. Upload this whole project folder to it: on the repository page click **Add file > Upload files**, drag in the files and folders (skip any `node_modules` folder), and click **Commit changes**.
3. Open `web/config.js` on GitHub (pencil icon) and replace `https://YOUR-TUNNEL-ADDRESS.trycloudflare.com` with your tunnel address from Part A. Commit the change.
4. Create a free account at https://vercel.com (sign in with GitHub). Click **Add New > Project** and import your repository.
5. Important: under **Root Directory** choose `web`. Leave the build settings empty (no framework, no build command). Click **Deploy**.
6. Vercel gives you an address like `https://urban-trifts-support-desk.vercel.app`. Copy it.

## Part C: Allow your Vercel address on the server

Close the server window, then in the `server` folder start it with your Vercel address (no trailing slash):

- Windows Command Prompt:
  ```
  set ALLOWED_ORIGINS=https://urban-trifts-support-desk.vercel.app
  npm start
  ```
- Optional access key: also run `set CHAT_ACCESS_KEY=your-long-key` before `npm start`, and put the same key in `web/config.js` (`accessKey`).

## Part D: Test

Open your Vercel address on your phone or another computer. Type a message. The first answer can take a minute.

## Every time you want the demo to work

1. Ollama running
2. `npm start` in `server` (with the ALLOWED_ORIGINS line above)
3. The tunnel window running

## Important notes

- The free quick tunnel gets a NEW address every time you restart it. When that happens, edit `web/config.js` on GitHub with the new address. Vercel redeploys on its own within a minute.
- The access key in `config.js` is visible to anyone who opens the page, so it only keeps strangers out casually.
- When your PC is off, the page still opens but the chat shows "I can't reach the chat server". For job applications, add a screen recording to your README so people can see it working.
