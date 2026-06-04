import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const runnerDir = path.join(root, "resources", "runners", "llama.cpp");
const server = path.join(runnerDir, "llama-server.exe");
const legacyCli = path.join(runnerDir, "llama-cli.exe");
const resourceRoot = path.join(root, "resources");
const model = path.join(root, "resources", "models", "chat", "qwen3-0.6b-q8_0", "Qwen3-0.6B-Q8_0.gguf");
const modelArg = path.join("models", "chat", "qwen3-0.6b-q8_0", "Qwen3-0.6B-Q8_0.gguf");
const manifest = path.join(root, "resources", "models", "chat", "qwen3-0.6b-q8_0", "manifest.json");

if (!fs.existsSync(server)) {
  fail(`missing llama.cpp server runner: ${server}`);
}
if (!fs.existsSync(legacyCli)) {
  fail(`missing legacy llama.cpp CLI fallback: ${legacyCli}`);
}
if (!fs.existsSync(model)) {
  fail(`missing local model file: ${model}`);
}
if (!fs.existsSync(manifest)) {
  fail(`missing local model manifest: ${manifest}`);
}

const port = await reservePort();
let serverChild = null;
const child = spawn(
  server,
  ["-m", modelArg, "--host", "127.0.0.1", "--port", String(port), "--jinja", "--reasoning", "off"],
  {
    cwd: resourceRoot,
    windowsHide: true,
    stdio: ["ignore", "ignore", "pipe"],
  },
);
serverChild = child;

let stderr = "";
child.stderr?.on("data", (chunk) => {
  stderr += chunk.toString("utf8");
  if (stderr.length > 4096) {
    stderr = stderr.slice(-4096);
  }
});

try {
  await waitForHealth(port, 90_000);
  const response = await postJson(port, "/v1/chat/completions", {
    model: "qwen3-0.6b-q8_0",
    messages: [
      { role: "system", content: "You are Mio. Reply briefly." },
      { role: "user", content: "hello" },
    ],
    stream: false,
    max_tokens: 32,
    temperature: 0.7,
  }, 90_000);
  const text = extractText(response);
  if (!text.trim()) {
    fail(`local model server returned empty chat text; response keys=${Object.keys(response).join(",")}`);
  }
  console.log("Local model server smoke validation passed");
} finally {
  child.kill();
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port) {
          resolve(port);
        } else {
          reject(new Error("could not reserve a local port"));
        }
      });
    });
    server.on("error", reject);
  });
}

async function waitForHealth(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) {
      fail(`llama-server exited before health ready; code=${child.exitCode}; stderr=${stderr}`);
    }
    try {
      const health = await getHealth(port);
      if (health.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(`llama-server health did not become ready within ${timeoutMs}ms; stderr=${stderr}`);
}

function getHealth(port) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { hostname: "127.0.0.1", port, path: "/health", method: "GET", timeout: 1500 },
      (response) => {
        response.resume();
        response.on("end", () => resolve({ ok: response.statusCode && response.statusCode >= 200 && response.statusCode < 300 }));
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error("health timeout"));
    });
    request.on("error", reject);
    request.end();
  });
}

function postJson(port, requestPath, body, timeoutMs) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "content-type": "application/json",
          "content-length": payload.length,
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`HTTP ${response.statusCode}: ${text}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("chat timeout")));
    request.on("error", reject);
    request.write(payload);
    request.end();
  });
}

function extractText(value) {
  const choice = value?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => item?.text).filter(Boolean).join("\n");
  }
  if (typeof choice?.text === "string") {
    return choice.text;
  }
  if (typeof value?.output_text === "string") {
    return value.output_text;
  }
  return "";
}

function fail(message) {
  serverChild?.kill();
  console.error(`Local model server smoke validation failed: ${message}`);
  process.exit(1);
}
