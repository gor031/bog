import { Handler } from '@netlify/functions';
import { GoogleGenAI } from '@google/genai';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');
    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
    }

    const getKeys = () => {
      const keys: string[] = [];
      if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
      if (process.env.GEMINI_API_KEY_1) keys.push(process.env.GEMINI_API_KEY_1);
      if (process.env.GEMINI_API_KEY_2) keys.push(process.env.GEMINI_API_KEY_2);
      if (process.env.GEMINI_API_KEY_3) keys.push(process.env.GEMINI_API_KEY_3);
      
      return [...new Set(keys.map(k => k.trim()))].filter(Boolean);
    };

    const keys = getKeys();
    if (keys.length === 0) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: '백엔드 서버에 설정된 API 키가 없습니다. Netlify 환경 변수를 확인해주세요.' }) 
      };
    }

    // 서버리스(Stateless) 환경이므로 무작위로 키를 선택하여 로드밸런싱
    const currentKey = keys[Math.floor(Math.random() * keys.length)];

    const ai = new GoogleGenAI({ apiKey: currentKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
    });

    if (response.text != null) {
      return { 
        statusCode: 200, 
        body: JSON.stringify({ text: response.text }) 
      };
    } else {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: '응답을 생성하지 못했습니다.' }) 
      };
    }
  } catch (err: any) {
    console.error('API Generation Error:', err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: err.message || '글 생성을 실패했습니다. 다시 시도해주세요.' }) 
    };
  }
};
