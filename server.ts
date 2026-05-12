import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json());

  // 환경변수에서 등록된 모든 키를 배열로 수집
  const getKeys = () => {
    const keys: string[] = [];
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY_1) keys.push(process.env.GEMINI_API_KEY_1);
    if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
    if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
    
    // 빈 값 제거 및 중복 제거
    return [...new Set(keys.map(k => k.trim()))].filter(Boolean);
  };

  let keyIndex = 0;

  // 로컬 백엔드 API 라우트 - 브라우저는 이 API로만 요청을 보냅니다 (키 숨김)
  app.post('/api/generate', async (req, res) => {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const keys = getKeys();
    if (keys.length === 0) {
      return res.status(500).json({ error: '백엔드 서버에 설정된 API 키가 없습니다. 환경변수를 확인해주세요.' });
    }

    // 순환하며 키 사용 (Rate Limit 방지)
    const currentKey = keys[keyIndex % keys.length];
    keyIndex++;

    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const response = await ai.models.generateContent({
        model: 'gemma-4-26b-a4b-it',
        contents: prompt,
      });

      if (response.text != null) {
        res.json({ text: response.text });
      } else {
        res.status(500).json({ error: '응답을 생성하지 못했습니다.' });
      }
    } catch (err: any) {
      console.error('API Generation Error:', err);
      res.status(500).json({ error: err.message || '글 생성을 실패했습니다. 다시 시도해주세요.' });
    }
  });

  // Vite middleware for development & production fallback
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static build files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
