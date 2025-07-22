import express from 'express';
import { chatCompletion } from './chat.js';

const app = express();
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