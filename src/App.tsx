import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Download, Loader2, Sparkles, FileText, CheckCircle2, Copy, Check } from 'lucide-react';
import { cn } from './lib/utils';
const LENGTH_OPTIONS = [
  { value: 1000, label: '약 1,000자 (짧은 글)' },
  { value: 2000, label: '약 2,000자 (기본 블로그 글)' },
  { value: 3000, label: '약 3,000자 (상세한 가이드)' },
];

export default function App() {
  const [topic, setTopic] = useState('');
  const [targetLength, setTargetLength] = useState(2000);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPost, setGeneratedPost] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [currentKeyIndex, setCurrentKeyIndex] = useState(0);

  const currentYear = new Date().getFullYear();
  const currentDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  const getAvailableKeys = () => {
    const keys: string[] = [];
    
    // 환경변수 키 (Vite)
    const envKey1 = import.meta.env.VITE_GEMINI_API_KEY_1;
    const envKey2 = import.meta.env.VITE_GEMINI_API_KEY_2;
    const envKey3 = import.meta.env.VITE_GEMINI_API_KEY_3;
    
    if (envKey1 && !keys.includes(envKey1)) keys.push(envKey1);
    if (envKey2 && !keys.includes(envKey2)) keys.push(envKey2);
    if (envKey3 && !keys.includes(envKey3)) keys.push(envKey3);

    // AI Studio 기본 키
    const defaultKey = process.env.GEMINI_API_KEY;
    if (defaultKey && !keys.includes(defaultKey)) keys.push(defaultKey);
    
    return keys;
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setGeneratedPost('');
    setError(null);

    const availableKeys = getAvailableKeys();
    if (availableKeys.length === 0) {
      setError('설정된 API 키가 없습니다. .env 파일에 환경변수로 설정해주세요.');
      setIsGenerating(false);
      return;
    }

    // Rotate key
    const currentKey = availableKeys[currentKeyIndex % availableKeys.length];
    setCurrentKeyIndex((prev) => prev + 1);

    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const prompt = `
당신은 최고의 SEO 전문가이자 전문 블로그 콘텐츠 마케터입니다.
오늘 날짜는 ${currentDate}입니다. 이 시점에 맞는 최신 트렌드와 정보를 반영하여,
다음 주제에 대해 검색 엔진 최적화(SEO)가 잘 된 매력적인 블로그 글을 작성해주세요.

[작성 조건]
1. 주제: "${topic}"
2. 목표 분량: 약 ${targetLength}자 내외
3. 필수 항목: 내용 중에 반드시 관련 데이터를 정리한 마크다운 "표(Table)"를 1개 이상 포함할 것.
4. 서식: H1, H2, H3 태그를 적절히 사용하여 구조적인 마크다운(Markdown) 포맷으로 작성할 것.
5. 문체: 독자가 읽기 편안하고 자연스러운 한국어로 서술할 것 (경어체).
6. SEO 최적화: 핵심 키워드가 제목과 본문에 자연스럽게 반복되도록 할 것. 도입부에서 독자의 흥미를 끌고, 결론에서 명확한 요약이나 CTA(Call to Action)를 제공할 것.
      `;

      const response = await ai.models.generateContent({
        model: 'gemma-4-31b-it',
        contents: prompt,
      });

      if (response.text != null) {
        setGeneratedPost(response.text);
      } else {
        throw new Error('응답을 생성하지 못했습니다.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || '글 생성을 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedPost) return;
    const blob = new Blob([generatedPost], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${topic.replace(/[^a-zA-Z0-9가-힣]/g, '_') || 'blog_post'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    if (!generatedPost) return;
    navigator.clipboard.writeText(generatedPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 py-6 px-4 md:px-8 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
                SEO 블로그 글 생성기
              </h1>
              <p className="text-sm text-slate-500 hidden md:block">
                주제만 입력하면 완벽하게 구조화된 마크다운 포맷의 블로그 글을 작성해 드립니다.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8 items-start">
        {/* Input Panel */}
        <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm sticky top-8">
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            포스팅 설정
          </h2>

          <form onSubmit={handleGenerate} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="topic" className="block text-sm font-medium text-slate-700">
                블로그 주제
              </label>
              <textarea
                id="topic"
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`어떤 내용의 글을 작성하고 싶으신가요? (예: ${currentYear}년 최고의 노트북 추천, 초보자를 위한 파이썬 독학 가이드)`}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm transition-all"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                글자 수 목표 (단위)
              </label>
              <div className="flex flex-col gap-2">
                {LENGTH_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 border rounded-xl cursor-pointer transition-all text-sm",
                      targetLength === option.value
                        ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600 font-medium"
                        : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="length"
                        value={option.value}
                        checked={targetLength === option.value}
                        onChange={() => setTargetLength(option.value)}
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </div>
                    {targetLength === option.value && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="w-full bg-blue-600 text-white rounded-xl py-3.5 px-4 flex items-center justify-center gap-2 font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  블로그 글 생성하기
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output Panel */}
        <div className="w-full lg:w-2/3">
          {error && (
            <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 mb-6">
              {error}
            </div>
          )}

          {!isGenerating && !generatedPost && !error && (
            <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-12 text-center h-[500px]">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">미리보기 영역</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                좌측 패널에서 주제와 목표 글자 수를 선택하고 '생성하기' 버튼을 누르면 이 곳에 작성된 글이 나타납니다.
              </p>
            </div>
          )}

          {isGenerating && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm h-[500px] flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-6" />
              <div className="space-y-4 w-full max-w-md animate-pulse">
                <div className="h-4 bg-slate-200 rounded-full w-3/4 mx-auto"></div>
                <div className="h-4 bg-slate-200 rounded-full w-5/6 mx-auto"></div>
                <div className="h-4 bg-slate-200 rounded-full w-4/5 mx-auto"></div>
              </div>
              <p className="mt-8 text-slate-500 text-sm font-medium">
                AI가 최고 수준의 SEO 블로그 글을 기획하고 작성 중입니다...
              </p>
            </div>
          )}

          {generatedPost && !isGenerating && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 items-center justify-between flex sticky top-0 z-10">
                <h3 className="font-semibold flex items-center gap-2 text-slate-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  생성 완료
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors shadow-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? '복사됨' : '복사하기'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    .md 파일 다운로드
                  </button>
                </div>
              </div>
              <div className="p-6 md:p-8 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
                <div className="markdown-body">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {generatedPost}
                  </Markdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
