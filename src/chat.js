import { v4 as uuid } from "uuid";

const TOKEN = process.env.TOKEN;
const BASE_URL = process.env.BASE_URL; // 'https://kimi.ai/api/chat';
const IS_DEBUG_MODE = process.env.IS_DEBUG_MODE === "true";
const KEEP_LAST_SESSION = process.env.KEEP_LAST_SESSION === "true";
const LAST_MESSAGE_ONLY = process.env.LAST_MESSAGE_ONLY === "true";

const Session = {
  currentSession: null,

  getSession(id) {
    if (id) {
      this.setSession(id);
    }
    if (this.currentSession === null) {
      this.setSession(uuid());
    }
    return this.currentSession;
  },

  setSession(session) {
    this.currentSession = session;
  },
};

export async function chatCompletion(req, res) {
  const { id, messages, model = "kimi", stream = false } = req.body;

  if (IS_DEBUG_MODE) {
    console.log("Request body:", req.body);
    console.log("Chat ID:", chatId);
  }

  if (!TOKEN) {
    return res
      .status(500)
      .json({ error: "TOKEN -> KIMI_REFRESH_TOKEN not set" });
  }

  const chatId = KEEP_LAST_SESSION ? Session.getSession(id) : uuid();

  if (LAST_MESSAGE_ONLY) {
    messages = messages.slice(-1);
  }

  const payload = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    model,
    stream,
  };

  if (IS_DEBUG_MODE) {
    console.log(`payload: ${JSON.stringify(payload)}`);
  }

  const kimiResp = await fetch(`${BASE_URL}/completions?chat_id=${chatId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      cookie: `refresh_token=${TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  if (IS_DEBUG_MODE) {
    console.log(`kimiResp: ${JSON.stringify(kimiResp)}`);
  }

  if (!kimiResp.ok) {
    return res.status(kimiResp.status).json({ error: await kimiResp.text() });
  }

  /* ---------- СТРИМ ---------- */
  if (stream) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    const decoder = new TextDecoder();
    const reader = kimiResp.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
    return;
  }

  /* ---------- ОБЫЧНЫЙ ОТВЕТ ---------- */
  const data = await kimiResp.json();
  const content = data.text || data.choices?.[0]?.message?.content || "";

  res.json({
    id: chatId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}
