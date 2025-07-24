import express from 'express';
import { chatCompletion } from './chat.js';

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); 
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Обработка предварительного OPTIONS-запроса
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});
app.use(express.json());

app.post('/v1/chat/completions', chatCompletion);

app.get('/v1/models', (_req, res) => {
  res.json({
    object: 'list',
    data: [{ id: 'kimi', object: 'model', owned_by: 'moonshot' }]
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Kimi proxy listening on :${port}`));