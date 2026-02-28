import express from "express";
import { chatCompletion } from "./chat.js";

const app = express();

// CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Роуты
app.post("/v1/chat/completions", chatCompletion);

app.get("/v1/models", async (_req, res) => {
  try {
    // Пробрасываем запрос к Kimi-Free-API
    const KIMI_FREE_API_URL =
      process.env.KIMI_FREE_API_URL || "http://localhost:8000";
    const response = await fetch(`${KIMI_FREE_API_URL}/v1/models`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    // Fallback если Kimi-Free-API недоступен
    res.json({
      object: "list",
      data: [
        { id: "kimi-k2", object: "model", owned_by: "moonshot" },
        { id: "kimi-k2-thinking", object: "model", owned_by: "moonshot" },
        { id: "kimi-search", object: "model", owned_by: "moonshot" },
        { id: "kimi-research", object: "model", owned_by: "moonshot" },
        { id: "kimi", object: "model", owned_by: "moonshot" },
      ],
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Kimi proxy listening on :${port}`);
  console.log(
    `Kimi-Free-API URL: ${
      process.env.KIMI_FREE_API_URL || "http://localhost:8000"
    }`
  );
});
