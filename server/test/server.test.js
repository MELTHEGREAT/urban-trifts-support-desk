// Tests the chat server against a fake Ollama, so no real model is needed.
// Run with: npm test

const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

let mockOllama;
let mockMode = "ok";
let lastOllamaRequest = null;

function startMock() {
  return new Promise((resolve) => {
    mockOllama = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.setHeader("Content-Type", "application/json");
        if (req.url === "/api/tags") {
          return res.end(JSON.stringify({ models: [{ name: "llama3.2:latest" }] }));
        }
        lastOllamaRequest = JSON.parse(body);
        if (mockMode === "missing-model") {
          res.statusCode = 404;
          return res.end(JSON.stringify({ error: "model 'llama3.2' not found" }));
        }
        const userMessages = lastOllamaRequest.messages.filter((m) => m.role === "user");
        res.end(
          JSON.stringify({
            message: { role: "assistant", content: `Heard ${userMessages.length} user message(s).` },
          })
        );
      });
    });
    mockOllama.listen(0, () => resolve(mockOllama.address().port));
  });
}

async function startApp(ollamaUrl) {
  process.env.OLLAMA_URL = ollamaUrl;
  delete require.cache[require.resolve("../server.js")];
  const { app } = require("../server.js");
  return new Promise((resolve) => {
    const s = app.listen(0, () => resolve({ server: s, base: `http://localhost:${s.address().port}` }));
  });
}

const post = (base, body) =>
  fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("chat server", async (t) => {
  const mockPort = await startMock();
  const { server, base } = await startApp(`http://localhost:${mockPort}`);

  await t.test("returns an AI reply and sends system prompt first", async () => {
    mockMode = "ok";
    const r = await post(base, { messages: [{ role: "user", content: "Hi, I'm Sam" }] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).reply, "Heard 1 user message(s).");
    assert.strictEqual(lastOllamaRequest.messages[0].role, "system");
    assert.match(lastOllamaRequest.messages[0].content, /Urban Trifts/);
    assert.strictEqual(lastOllamaRequest.stream, false);
  });

  await t.test("forwards earlier messages so follow-ups have context", async () => {
    const r = await post(base, {
      messages: [
        { role: "user", content: "My name is Sam" },
        { role: "assistant", content: "Nice to meet you, Sam!" },
        { role: "user", content: "What's my name?" },
      ],
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(lastOllamaRequest.messages.length, 4); // system + 3
    assert.strictEqual(lastOllamaRequest.messages[1].content, "My name is Sam");
  });

  await t.test("keeps only the 20 most recent messages", async () => {
    const msgs = [];
    for (let i = 0; i < 30; i++) {
      msgs.push({ role: i % 2 === 0 ? "user" : "assistant", content: `m${i}` });
    }
    msgs.push({ role: "user", content: "last" });
    await post(base, { messages: msgs });
    assert.strictEqual(lastOllamaRequest.messages.length, 21); // system + 20
    assert.strictEqual(lastOllamaRequest.messages.at(-1).content, "last");
  });

  await t.test("rejects bad input with 400", async () => {
    assert.strictEqual((await post(base, {})).status, 400);
    assert.strictEqual((await post(base, { messages: [] })).status, 400);
    assert.strictEqual(
      (await post(base, { messages: [{ role: "system", content: "x" }] })).status,
      400
    );
    assert.strictEqual(
      (await post(base, { messages: [{ role: "assistant", content: "x" }] })).status,
      400
    );
    assert.strictEqual(
      (await post(base, { messages: [{ role: "user", content: "   " }] })).status,
      400
    );
  });

  await t.test("explains when the model isn't installed", async () => {
    mockMode = "missing-model";
    const r = await post(base, { messages: [{ role: "user", content: "hi" }] });
    const j = await r.json();
    assert.strictEqual(r.status, 404);
    assert.strictEqual(j.error, "model_not_found");
    assert.match(j.message, /ollama pull/);
  });

  await t.test("health check sees Ollama and the model", async () => {
    const j = await (await fetch(`${base}/api/health`)).json();
    assert.deepStrictEqual(
      { ok: j.ok, ollamaRunning: j.ollamaRunning, modelInstalled: j.modelInstalled },
      { ok: true, ollamaRunning: true, modelInstalled: true }
    );
  });

  await t.test("access key is enforced only when configured", async () => {
    process.env.CHAT_ACCESS_KEY = "secret";
    const keyed = await startApp(`http://localhost:${mockPort}`);
    const body = { messages: [{ role: "user", content: "hi" }] };
    const url = `${keyed.base}/api/chat`;
    const send = (headers) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    assert.strictEqual((await send({})).status, 401);
    assert.strictEqual((await send({ "x-chat-key": "wrong" })).status, 401);
    assert.strictEqual((await send({ "x-chat-key": "secret" })).status, 200);
    keyed.server.close();
    delete process.env.CHAT_ACCESS_KEY;
  });

  await t.test("allows a configured deployed origin via CORS", async () => {
    process.env.ALLOWED_ORIGINS = "https://my-dash.vercel.app/";
    const c = await startApp(`http://localhost:${mockPort}`);
    const ok = await fetch(`${c.base}/api/health`, { headers: { Origin: "https://my-dash.vercel.app" } });
    assert.strictEqual(ok.headers.get("access-control-allow-origin"), "https://my-dash.vercel.app");
    const bad = await fetch(`${c.base}/api/health`, { headers: { Origin: "https://evil.example" } });
    assert.strictEqual(bad.headers.get("access-control-allow-origin"), null);
    c.server.close();
    delete process.env.ALLOWED_ORIGINS;
  });

  server.close();

  await t.test("friendly error when Ollama is not running", async () => {
    // Port 1 has nothing listening, which is what "Ollama not running" looks like.
    const down = await startApp("http://localhost:1");
    const r = await post(down.base, { messages: [{ role: "user", content: "hi" }] });
    const j = await r.json();
    assert.strictEqual(r.status, 503);
    assert.strictEqual(j.error, "ollama_not_running");
    assert.match(j.message, /Ollama/);

    const h = await (await fetch(`${down.base}/api/health`)).json();
    assert.strictEqual(h.ollamaRunning, false);
    down.server.close();
  });

  mockOllama.close();
});
