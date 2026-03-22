/**
 * 浏览器原生 TTS (Web Speech API - speechSynthesis)
 * 纯本地、零成本、无需 API key
 */

let voicesLoaded = false;
let cachedVoices: SpeechSynthesisVoice[] = [];

function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  if (voicesLoaded) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  if (cachedVoices.length > 0) voicesLoaded = true;
  return cachedVoices;
}

/** 获取所有中文语音列表，供 UI 选择器使用 */
export function getChineseVoices(): { name: string; lang: string }[] {
  return getVoices()
    .filter((v) => v.lang.startsWith("zh"))
    .map((v) => ({ name: v.name, lang: v.lang }));
}

/** 获取所有英文语音列表 */
export function getEnglishVoices(): { name: string; lang: string }[] {
  return getVoices()
    .filter((v) => v.lang.startsWith("en"))
    .map((v) => ({ name: v.name, lang: v.lang }));
}

/** 选择最佳中文语音，fallback 到默认 */
function pickChineseVoice(voiceName?: string): SpeechSynthesisVoice | undefined {
  const voices = getVoices();
  if (voiceName) {
    const match = voices.find((v) => v.name === voiceName);
    if (match) return match;
  }
  const zhCN = voices.filter((v) => v.lang.startsWith("zh"));
  const preferred = zhCN.find((v) => /xiaoxiao|huihui|ting-ting|lili/i.test(v.name));
  return preferred || zhCN[0] || undefined;
}

/** 选择最佳英文语音 */
function pickEnglishVoice(voiceName?: string): SpeechSynthesisVoice | undefined {
  const voices = getVoices();
  if (voiceName) {
    const match = voices.find((v) => v.name === voiceName);
    if (match) return match;
  }
  const en = voices.filter((v) => v.lang.startsWith("en"));
  const preferred = en.find((v) => /zira|david|samantha|karen|daniel|jenny|aria/i.test(v.name));
  return preferred || en[0] || undefined;
}

export interface TtsOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voiceName?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number, charLength: number) => void;
}

/**
 * 朗读文本，返回 cancel 函数
 * 支持通过 voiceName 指定语音
 */
export function speak(text: string, opts: TtsOptions = {}): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    opts.onEnd?.();
    return () => { };
  }

  // 只在确实有正在播放的语音时才 cancel，避免不必要的引擎重置延迟
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
    window.speechSynthesis.cancel();
  }

  const lang = opts.lang ?? "zh-CN";
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = lang.startsWith("en") ? pickEnglishVoice(opts.voiceName) : pickChineseVoice(opts.voiceName);
  if (voice) utterance.voice = voice;
  utterance.lang = lang;
  utterance.rate = opts.rate ?? 1.1;
  utterance.pitch = opts.pitch ?? 1;
  utterance.volume = opts.volume ?? 1;

  utterance.onstart = () => opts.onStart?.();
  utterance.onend = () => opts.onEnd?.();
  utterance.onerror = () => opts.onEnd?.();
  if (opts.onBoundary) {
    utterance.onboundary = (e) => opts.onBoundary?.(e.charIndex, e.charLength);
  }

  window.speechSynthesis.speak(utterance);

  return () => { window.speechSynthesis.cancel(); };
}

/** 停止所有语音 */
export function stopSpeaking() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** 预加载语音列表（Chrome 需要异步加载）+ 预热 TTS 引擎 */
export function preloadVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(); return; }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
      warmupTts();
      resolve();
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      warmupTts();
      resolve();
    };
    setTimeout(resolve, 2000);
  });
}

/** 静音预热 TTS 引擎，消除首次调用的冷启动延迟 */
function warmupTts() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance("");
  u.volume = 0;
  u.rate = 10; // 最快速度，瞬间完成
  window.speechSynthesis.speak(u);
}
