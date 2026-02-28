import { v4 as uuid } from "uuid";

const KIMI_FREE_API_URL =
  process.env.KIMI_FREE_API_URL || "http://localhost:8000";
const IS_DEBUG_MODE = process.env.IS_DEBUG_MODE === "true";

// Хранилище сессий (conversation_id от Kimi-Free-API)
const sessions = new Map();

/**
 * Получает или создает сессию
 */
function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

function setSession(sessionId, conversationId) {
  sessions.set(sessionId, {
    conversationId,
    lastUsed: Date.now(),
  });
}

export async function chatCompletion(req, res) {
  try {
    const {
      messages,
      model = "kimi-k2",
      stream = false,
      session_id,
    } = req.body;

    // Извлекаем токен из заголовка запроса (от клиента)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header required" });
    }

    const sessionId =
      req.headers["x-session-id"] || req.body.session_id || null;

    if (IS_DEBUG_MODE) {
      console.log("Request body:", req.body);
      console.log("Session ID:", session_id);
    }

    // Определяем conversation_id для многоступенчатого диалога
    let conversationId = null;

    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        conversationId = session.conversationId;
        if (IS_DEBUG_MODE) {
          console.log(`Found existing conversation: ${conversationId}`);
        }
      }
    }

    // Формируем payload для Kimi-Free-API
    const payload = {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream,
      // Важно: передаем conversation_id только если есть сессия
      ...(conversationId && { conversation_id: conversationId }),
    };

    if (IS_DEBUG_MODE) {
      console.log(
        `Payload to Kimi-Free-API: ${JSON.stringify(payload, null, 2)}`
      );
    }

    // Отправляем запрос к Kimi-Free-API
    const kimiResp = await fetch(`${KIMI_FREE_API_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader, // Пробрасываем токен от клиента
      },
      body: JSON.stringify(payload),
    });

    if (IS_DEBUG_MODE) {
      console.log(`Kimi-Free-API response status: ${kimiResp.status}`);
    }

    if (!kimiResp.ok) {
      const errorText = await kimiResp.text();
      console.error("Kimi-Free-API error:", errorText);
      return res.status(kimiResp.status).json({
        error: "Kimi-Free-API error",
        details: errorText,
      });
    }

    // Обрабатываем ответ
    if (stream) {
      return handleStream(kimiResp, res, model, session_id);
    } else {
      return handleRegularResponse(kimiResp, res, model, session_id);
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Обработка стриминга
 */
async function handleStream(response, res, model, sessionId) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let conversationId = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            // Сохраняем conversation_id из первого чанка
            if (parsed.id && !conversationId && sessionId) {
              conversationId = parsed.id;
              setSession(sessionId, conversationId);
              if (IS_DEBUG_MODE) {
                console.log(
                  `Saved conversation_id: ${conversationId} for session: ${sessionId}`
                );
              }
            }

            // Пробрасываем как есть
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
          } catch (e) {
            // Если не JSON, пробрасываем как текст
            res.write(`data: ${data}\n\n`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Stream error:", error);
  } finally {
    res.end();
  }
}

/**
 * Обработка обычного ответа
 */
async function handleRegularResponse(response, res, model, sessionId) {
  const data = await response.json();

  // Сохраняем conversation_id если есть session_id
  if (sessionId && data.id) {
    setSession(sessionId, data.id);
    if (IS_DEBUG_MODE) {
      console.log(
        `Saved conversation_id: ${data.id} for session: ${sessionId}`
      );
    }

    // Добавляем session_id в ответ для клиента
    data.session_id = sessionId;
  }

  res.json(data);
}
