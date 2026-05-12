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
      const responseStream = await ai.models.generateContentStream({
        model: 'gemma-4-31b-it',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        }
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('X-Accel-Buffering', 'no'); // 프록시(Nginx)가 응답을 버퍼링하지 않고 즉시 보내도록 설정
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.flushHeaders(); // 헤더를 클라이언트로 즉시 전송

      let keepAlive: NodeJS.Timeout | null = null;
      const startKeepAlive = () => {
        if (keepAlive) clearInterval(keepAlive);
        keepAlive = setInterval(() => {
          res.write('\u200B'); // Zero-width space로 보이지 않는 핑을 보내고, 버퍼를 플러시하여 타임아웃 우회
        }, 3000); // 간격을 3초로 단축
      };

      startKeepAlive();

      try {
        for await (const chunk of responseStream) {
          startKeepAlive(); // 매 청크 도착 시 무응답 타이머 리셋
          if (chunk.text) {
            res.write(chunk.text);
          }
        }
      } finally {
        if (keepAlive) clearInterval(keepAlive);
      }
      res.end();
    } catch (err: any) {
      console.error('API Generation Error:', err);
      // If headers are already sent, we can't send status 500, so we just end it with error text or abort.
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || '글 생성을 실패했습니다. 다시 시도해주세요.' });
      } else {
        res.end(`\n\n[오류 발생: ${err.message}]`);
      }
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // 긴 텍스트 생성 중 Node.js 서버가 연결을 끊는 문제(502 에러) 방지
  server.setTimeout(30 * 60 * 1000); // 30분
  server.keepAliveTimeout = 30 * 60 * 1000;
  server.headersTimeout = 30 * 60 * 1000 + 1000;
}

startServer();
