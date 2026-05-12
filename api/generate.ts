export const config = {
  runtime: 'edge',
};

import { GoogleGenAI } from '@google/genai';

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 환경 변수에서 여러 키를 수집
    const keys: string[] = [];
    if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
    if (process.env.GEMINI_API_KEY_1) keys.push(process.env.GEMINI_API_KEY_1);
    if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
    if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
    
    const validKeys = [...new Set(keys.map(k => k.trim()))].filter(Boolean);

    if (validKeys.length === 0) {
      return new Response(JSON.stringify({ error: 'API 키가 구성되지 않았습니다.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Vercel Edge에서는 상태를 유지하지 않으므로 난수로 키 선택
    const currentKey = validKeys[Math.floor(Math.random() * validKeys.length)];

    const ai = new GoogleGenAI({ apiKey: currentKey });
    const responseStream = await ai.models.generateContentStream({
      model: 'gemma-4-31b-it',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const stream = new ReadableStream({
      async start(controller) {
        let keepAliveInterval: any;
        
        try {
          // Vercel Edge 타임아웃 방지를 위한 핑
          keepAliveInterval = setInterval(() => {
            controller.enqueue(new TextEncoder().encode('\u200B'));
          }, 5000);

          for await (const chunk of responseStream) {
            if (keepAliveInterval) {
              clearInterval(keepAliveInterval);
              // 그 이후 다시 핑 시작
              keepAliveInterval = setInterval(() => {
                controller.enqueue(new TextEncoder().encode('\u200B'));
              }, 5000);
            }
            if (chunk.text) {
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
        } catch (e: any) {
          const errorMessage = `\n\n[오류 발생: ${e.message}]`;
          controller.enqueue(new TextEncoder().encode(errorMessage));
        } finally {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || '글 생성을 실패했습니다.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
