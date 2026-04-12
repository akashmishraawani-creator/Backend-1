import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.post("/api/chat", async (req, res) => {
  const { message, provider } = req.body;

  try {
    let apiUrl, headers, body;

    if (!provider || provider === "deepseek") {
      apiUrl = "https://api.deepseek.com/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      };
      body = {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a smart SaaS sales chatbot." },
          { role: "user", content: message }
        ]
      };
    } else {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      headers = {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      };
      body = {
        model: "deepseek/deepseek-chat:free",
        messages: [
          { role: "system", content: "You are a smart SaaS sales chatbot." },
          { role: "user", content: message }
        ]
      };
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content || "No response";

    res.json({ reply });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server started"));
