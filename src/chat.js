import { v4 as uuid } from 'uuid';

const TOKEN = process.env.TOKEN;
const BASE_URL = process.env.BASE_URL; // 'https://kimi.ai/api/chat';

export async function chatCompletion(req, res) {
  const { messages, model = 'kimi', stream = false } = req.body;

  if (!TOKEN) {
    return res.status(500).json({ error: 'TOKEN -> KIMI_REFRESH_TOKEN not set' });
  }

  const chatId = uuid();

  const payload = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    model,
    stream
  };

  const kimiResp = await fetch(`${BASE_URL}/completions?chat_id=${chatId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${TOKEN}`,
      cookie: `refresh_token=${TOKEN}`
    },
    body: JSON.stringify(payload)
  });

  if (!kimiResp.ok) {
    return res.status(kimiResp.status).json({ error: await kimiResp.text() });
  }

  /* ---------- СТРИМ ---------- */
  if (stream) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const decoder = new TextDecoder();
    const reader  = kimiResp.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
    return;
  }

  /* ---------- ОБЫЧНЫЙ ОТВЕТ ---------- */
  const data   = await kimiResp.json();
  const content = data.text || data.choices?.[0]?.message?.content || '';

  res.json({
    id: chatId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop'
      }
    ]
  });
}

// export async function chatCompletion(req, res) {
//   const { messages, model = 'kimi', stream = false } = req.body;

//   const chatId = uuid();
//   const payload = {
//     messages: messages.map(m => ({ role: m.role, content: m.content })),
//     model,
//     stream
//   };

//   const kimiResp = await fetch(`${BASE_URL}/completions`,
//     {
//       method: 'POST',
//       headers: {
//         'content-type': 'application/json',
//         authorization: `Bearer ${TOKEN}`,
//         cookie: `refresh_token=${TOKEN}`
//       },
//       body: JSON.stringify(payload)
//     }
//   );

//   if (!kimiResp.ok) {
//     return res.status(kimiResp.status).json({ error: await kimiResp.text() });
//   }

//   /* ---------- СТРИМ ---------- */
//   if (stream) {
//     res.setHeader('Content-Type', 'text/plain; charset=utf-8');
//     const reader = kimiResp.body.getReader();
//     const decoder = new TextDecoder();

//     while (true) {
//       const { done, value } = await reader.read();
//       if (done) break;
//       const chunk = decoder.decode(value);
//       // просто проксируем строки SSE
//       res.write(chunk.replace(/^data: /, ''));
//     }
//     res.end();
//     return;
//   }

//   /* ---------- ОБЫЧНЫЙ -------- */
//   const data = await kimiResp.json();
//   res.json({
//     id: chatId,
//     object: 'chat.completion',
//     created: Math.floor(Date.now() / 1000),
//     model,
//     choices: [
//       {
//         index: 0,
//         message: { role: 'assistant', content: data.text || '' },
//         finish_reason: 'stop'
//       }
//     ]
//   });
// }

// export async function chatCompletion(req, res) {
//   try {
//     const { messages, model = 'kimi', stream = false } = req.body;

//     // 1. Создаём новый диалог (POST /api/chat)
//     const createResp = await fetch(`${BASE_URL}/completions`, {
//       method: 'POST',
//       headers: {
//         'content-type': 'application/json',
//         'authorization': `Bearer ${KIMI_REFRESH_TOKEN}`,
//         'cookie': `refresh_token=${KIMI_REFRESH_TOKEN}`
//       },
//       body: JSON.stringify({
//         messages: messages.map(m => ({
//           role: m.role,
//           content: m.content
//         })),
//         model,
//         stream: false
//       })
//     });

//     if (!createResp.ok) {
//       return res.status(createResp.status).json({ error: await createResp.text() });
//     }

//     const data = await createResp.json();

//     // 2. Отдаём в OpenAI-формате
//     const openai = {
//       id: uuid(),
//       object: 'chat.completion',
//       created: Math.floor(Date.now() / 1000),
//       model,
//       choices: [{
//         index: 0,
//         message: {
//           role: 'assistant',
//           content: data.choices?.[0]?.message?.content || ''
//         },
//         finish_reason: 'stop'
//       }]
//     };
//     res.json(openai);
//   } catch (e) {
//     res.status(500).json({ error: e.message });
//   }
// }