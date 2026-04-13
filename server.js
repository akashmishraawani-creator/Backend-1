// ============================================================
// server.js — AI SaaS Chatbot Backend
// Supports: DeepSeek + OpenRouter | Deployable on Render
// ============================================================

import express from "express";
import cors from "cors";
import fetch from "node-fetch";

// ── App Setup ─────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 10000;

// ── Middleware ────────────────────────────────────────────
// Allow requests from any frontend origin (tighten in production)
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// ── Health Check Route ────────────────────────────────────
// GET / → quick check that the server is alive
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// ── Provider Config ───────────────────────────────────────
// Centralised config makes it easy to add new providers later
const PROVIDERS = {
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    apiKey: () => process.env.DEEPSEEK_API_KEY,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-3.5-turbo", // change to any model on OpenRouter
    apiKey: () => process.env.OPENROUTER_API_KEY,
  },
};

// ── Helper: Call AI Provider ──────────────────────────────
// Builds and fires the POST request to whichever provider is chosen.
// Returns the raw parsed JSON body from the provider.
async function callProvider(providerKey, userMessage) {
  const config = PROVIDERS[providerKey];

  const apiKey = config.apiKey();
  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${providerKey}". ` +
        `Set the environment variable and redeploy.`
    );
  }

  const requestBody = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  // ── Fire the request ──────────────────────────────────
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // OpenRouter requires these headers for rate-limit tiers
      ...(providerKey === "openrouter" && {
        "HTTP-Referer": "https://your-app.com", // replace with your domain
        "X-Title": "AI SaaS Chatbot",
      }),
    },
    body: JSON.stringify(requestBody),
  });

  // Parse body regardless of status so we can log errors
  const data = await response.json();

  // Log the full provider response for debugging
  console.log(
    `[${providerKey.toUpperCase()}] status=${response.status}`,
    JSON.stringify(data, null, 2)
  );

  if (!response.ok) {
    // Surface the provider's own error message when available
    const providerMsg =
      data?.error?.message || data?.message || "Unknown provider error";
    throw new Error(`${providerKey} API error (${response.status}): ${providerMsg}`);
  }

  return data;
}

// ── Helper: Extract Reply Text ────────────────────────────
// Both DeepSeek and OpenRouter follow the OpenAI response schema,
// but we guard defensively in case a provider varies slightly.
function extractReply(data) {
  // Standard OpenAI-compatible path
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text === "string" && text.trim()) return text.trim();

  // Fallback: some providers put the text directly
  if (typeof data?.content === "string") return data.content.trim();

  // Nothing usable found
  throw new Error("Could not parse a reply from the provider response.");
}

// ── POST /api/chat ────────────────────────────────────────
// Accepts: { "message": "...", "provider": "deepseek" | "openrouter" }
// Returns: { "reply": "..." }
app.post("/api/chat", async (req, res) => {
  try {
    const { message, provider } = req.body;

    // ── Input validation ────────────────────────────────
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Field 'message' is required and must be a non-empty string." });
    }

    // Default to openrouter if no provider specified
    const providerKey =
      typeof provider === "string" && provider.toLowerCase() === "deepseek"
        ? "deepseek"
        : "openrouter";

    // ── Call the chosen provider ────────────────────────
    const data = await callProvider(providerKey, message.trim());

    // ── Extract & return the reply ──────────────────────
    const reply = extractReply(data);
    return res.json({ reply });

  } catch (err) {
    // Log the full error server-side for debugging
    console.error("[/api/chat ERROR]", err.message);

    // Return a clean JSON error to the client
    return res.status(500).json({
      error: err.message || "Internal server error. Please try again.",
    });
  }
});

// ── 404 Catch-all ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
    
