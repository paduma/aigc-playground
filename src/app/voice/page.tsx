"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/lib/use-voice-input";
import { speak, stopSpeaking, preloadVoices } from "@/lib/use-tts";

/* ── Mock AI voice replies ── */
const MOCK_REPLIES: Record<string, string> = {
  hello: "Hey there! I'm your AI voice assistant. What can I help you with today?",
  weather: "It's sunny in San Francisco today, around 72°F — perfect for a walk. But this is just mock data, of course.",
  introduce: "I'm a voice conversation AI assistant demo. I showcase the interaction pattern of products like ChatGPT Advanced Voice and Google Gemini Live — full voice interaction with real-time interruption support.",
  help: "Sure! You can ask me about the weather, tech topics, or just chat. This demo shows how voice agents work in real products.",
  music: "I'd love to play some music for you, but I'm just a demo! In a real product, this could integrate with a music streaming API.",
  time: "I don't have a real clock, but in production this would call a time API. It's always demo o'clock here!",
  name: "I'm Yue, your AI voice assistant. Nice to meet you!",
  joke: "Why do programmers prefer dark mode? Because light attracts bugs! ...I'll see myself out.",
  code: "For voice-based coding help, you'd typically use something like GitHub Copilot Voice or Cursor. I can discuss code concepts though!",
  react: "React 19 is exciting — the new compiler auto-memoizes components, and Server Components reduce client-side JavaScript significantly.",
  ai: "AI is evolving fast. We're seeing multimodal models, real-time voice agents, and AI-powered code generation becoming mainstream in 2026.",
  thanks: "You're welcome! Happy to help anytime.",
  bye: "Goodbye! It was nice chatting with you. Have a great day!",
  what: "I'm an AI voice assistant demo built with Web Speech API. I can recognize your speech, process it, and respond with synthesized voice — all running locally in your browser.",
  how: "I work by combining the Web Speech Recognition API for listening, a mock AI engine for generating responses, and the Speech Synthesis API for speaking back. No server needed!",
  translate: "In a real product, I could translate between languages in real-time. Think of it like a personal interpreter — that's one of the hottest AI voice use cases right now.",
  news: "I don't have access to live news, but in production, a voice agent like me would pull from news APIs and summarize the latest headlines for you.",
  recommend: "Based on your interests, I'd recommend exploring the other demos in this playground — the chat page has some cool ECharts integration, and the Agent Flow page shows visual workflow editing.",
};

function findReply(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(MOCK_REPLIES)) {
    if (lower.includes(key)) return val;
  }
  // 智能兜底：根据输入长度和内容给出不同回复
  const fallbacks = [
    "That's an interesting point. In a real voice agent, I'd process your query through an LLM and give you a detailed response. Try asking about weather, AI, or React!",
    "Got it. Voice agents like me are designed for hands-free interaction — perfect for driving, cooking, or when you just don't feel like typing.",
    "I hear you! While I'm running on mock data, real voice assistants like Alexa+ and Gemini Live handle millions of queries like this every day.",
    "Good question! In production, this would go through speech-to-text, then to an LLM, and back through text-to-speech. The whole round trip takes under a second.",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

/* ── 语音波形可视化 ── */
function WaveformVisualizer({ active, spectrum }: { active: boolean; spectrum?: Uint8Array }) {
  const bars = 32;
  const jitter = [3, 7, 2, 5, 8, 1, 6, 4, 7, 3, 5, 2, 8, 6, 1, 4, 7, 3, 5, 8, 2, 6, 4, 1, 7, 3, 5, 8, 2, 6, 4, 1];
  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 80 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const val = active && spectrum ? (spectrum[i * 4] ?? 0) / 255 : 0;
        const h = active ? Math.max(4, val * 60 + jitter[i % jitter.length]) : 4;
        return (
          <span key={i} className={cn("w-[3px] rounded-full transition-all duration-75",
            active ? "bg-gradient-to-t from-indigo-500 to-violet-400" : "bg-muted-foreground/20")}
            style={{ height: `${h}px` }} />
        );
      })}
    </div>
  );
}

interface VoiceMessage { role: "user" | "assistant"; text: string; timestamp: number; }

export default function VoicePage() {
  const [inCall, setInCall] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiText, setAiText] = useState("");
  const [muted, setMuted] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inCallRef = useRef(false);
  const cancelTtsRef = useRef<(() => void) | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 预加载语音列表
  useEffect(() => { preloadVoices(); }, []);

  // 同步 ref
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);

  const ttsEnabledRef = useRef(ttsEnabled);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  const voice = useVoiceInput({
    lang: "en-US",
    onResult: (text) => {
      if (!text.trim()) return;
      const userMsg: VoiceMessage = { role: "user", text, timestamp: Date.now() };
      setMessages((prev) => [...prev, userMsg]);

      const reply = findReply(text);
      setAiSpeaking(true);
      setAiText("");

      // 清理上一轮残留的 typewriter
      if (typewriterRef.current) clearInterval(typewriterRef.current);

      // Typewriter effect + TTS
      let idx = 0;
      const interval = setInterval(() => {
        idx++;
        setAiText(reply.slice(0, idx));
        if (idx >= reply.length) {
          clearInterval(interval);
          typewriterRef.current = null;
          if (!ttsEnabledRef.current) {
            setAiSpeaking(false);
            setMessages((prev) => [...prev, { role: "assistant", text: reply, timestamp: Date.now() }]);
            setAiText("");
            if (inCallRef.current) voice.start();
          }
        }
      }, 30);
      typewriterRef.current = interval;

      if (ttsEnabledRef.current) {
        cancelTtsRef.current = speak(reply, {
          lang: "en-US",
          rate: 1.0,
          onEnd: () => {
            clearInterval(interval);
            typewriterRef.current = null;
            setAiText(reply);
            setAiSpeaking(false);
            setMessages((prev) => [...prev, { role: "assistant", text: reply, timestamp: Date.now() }]);
            setAiText("");
            cancelTtsRef.current = null;
            if (inCallRef.current) voice.start();
          },
        });
      }
    },
  });

  const startCall = useCallback(() => {
    setInCall(true);
    setMessages([]);
    setMuted(false);
    voice.start();
  }, [voice]);

  const endCall = useCallback(() => {
    setInCall(false);
    setMuted(false);
    voice.stop();
    stopSpeaking();
    cancelTtsRef.current = null;
    if (typewriterRef.current) { clearInterval(typewriterRef.current); typewriterRef.current = null; }
    setAiSpeaking(false);
    setAiText("");
  }, [voice]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      if (!prev) { voice.stop(); } else { if (!aiSpeaking) voice.start(); }
      return !prev;
    });
  }, [voice, aiSpeaking]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages, aiText]);

  // 组件卸载时清理所有资源
  useEffect(() => {
    return () => {
      stopSpeaking();
      cancelTtsRef.current = null;
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-md shadow-rose-500/20">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Voice Chat</h1>
            <p className="text-sm text-muted-foreground">Voice Agent · Real-time Speech · TTS Synthesis</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          {!inCall ? (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/10 to-pink-500/10 ring-1 ring-rose-500/20">
                <Mic className="h-14 w-14 text-rose-400/60" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">AI Voice Assistant</p>
                <p className="mt-1 text-sm text-muted-foreground">Tap the button below to start a voice conversation</p>
              </div>
              <Button onClick={startCall} size="lg" disabled={!voice.supported}
                className="gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-8 shadow-lg shadow-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                <Phone className="h-5 w-5" />Start Call
              </Button>
              {!voice.supported && (
                <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-400/20 rounded-lg px-3 py-2 max-w-sm">
                  当前浏览器不支持 Web Speech Recognition API，请使用 Chrome / Edge 体验语音对话。
                </p>
              )}
              <div className="mt-6 max-w-md rounded-xl border border-border bg-card/50 p-5 text-left">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-rose-400" />
                  <span className="text-sm font-medium text-foreground">Product Pattern</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Voice Agent is a fully voice-based interaction mode with no text input.
                  Examples: ChatGPT Advanced Voice, Google Gemini Live, Alexa+.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["Web Speech API", "Real-time STT", "speechSynthesis TTS", "Interruption", "Waveform Viz"].map((t) => (
                    <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative flex w-full max-w-lg flex-col items-center gap-6">
              <div className={cn("pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full blur-3xl transition-all duration-1000",
                aiSpeaking ? "h-64 w-64 bg-violet-500/8 animate-pulse"
                  : voice.isListening && !muted ? "h-56 w-56 bg-rose-500/8 voice-breathe"
                    : "h-40 w-40 bg-muted-foreground/3")} />
              <div className="relative flex items-center justify-center">
                {voice.isListening && !muted && !aiSpeaking && (
                  <>
                    <span className="absolute h-32 w-32 animate-ping rounded-full bg-rose-500/10 [animation-duration:2s]" />
                    <span className="absolute h-28 w-28 animate-ping rounded-full bg-rose-500/5 [animation-duration:2.5s] [animation-delay:0.3s]" />
                  </>
                )}
                {aiSpeaking && (
                  <>
                    <span className="absolute h-36 w-36 animate-ping rounded-full bg-violet-500/10 [animation-duration:1.5s]" />
                    <span className="absolute h-32 w-32 animate-ping rounded-full bg-violet-500/8 [animation-duration:2s] [animation-delay:0.4s]" />
                    <span className="absolute h-28 w-28 animate-ping rounded-full bg-indigo-500/5 [animation-duration:2.5s] [animation-delay:0.8s]" />
                  </>
                )}
                <div className={cn("relative z-10 flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300",
                  aiSpeaking ? "bg-gradient-to-br from-violet-500/25 to-indigo-500/25 shadow-lg shadow-violet-500/20 ring-2 ring-violet-500/40"
                    : voice.isListening && !muted ? "bg-gradient-to-br from-rose-500/25 to-pink-500/25 shadow-lg shadow-rose-500/20 ring-2 ring-rose-500/40 voice-glow"
                      : muted ? "bg-amber-500/10 ring-1 ring-amber-500/30" : "bg-secondary ring-1 ring-border")}>
                  {aiSpeaking ? <Volume2 className="h-10 w-10 text-violet-400" />
                    : voice.isListening && !muted ? <Mic className="h-10 w-10 text-rose-400" />
                      : muted ? <VolumeX className="h-10 w-10 text-amber-400" />
                        : <MicOff className="h-10 w-10 text-muted-foreground" />}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {muted ? "Muted" : aiSpeaking ? "AI is responding…" : voice.isListening ? "Listening…" : "Processing…"}
              </p>
              <WaveformVisualizer active={voice.isListening || aiSpeaking} spectrum={voice.spectrum ?? undefined} />

              {(voice.interimText || aiText) && (
                <div className="w-full rounded-xl border border-border bg-card/50 p-4">
                  {voice.interimText && (
                    <p className="text-sm text-foreground">
                      <span className="mr-2 text-xs text-rose-400">You:</span>{voice.interimText}
                    </p>
                  )}
                  {aiText && (
                    <p className="text-sm text-foreground">
                      <span className="mr-2 text-xs text-violet-400">AI:</span>{aiText}
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400" />
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4">
                <button onClick={toggleMute}
                  className={cn("flex h-12 w-12 items-center justify-center rounded-full transition-all",
                    muted ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                      : "bg-secondary text-muted-foreground ring-1 ring-border hover:text-foreground")}
                  title={muted ? "Unmute" : "Mute"}>
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <button onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={cn("flex h-12 w-12 items-center justify-center rounded-full transition-all text-xs font-medium",
                    ttsEnabled ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30"
                      : "bg-secondary text-muted-foreground ring-1 ring-border hover:text-foreground")}
                  title={ttsEnabled ? "Disable TTS" : "Enable TTS"}>
                  TTS
                </button>
                <Button onClick={endCall} size="lg" variant="destructive"
                  className="gap-2 rounded-full px-8 shadow-lg">
                  <PhoneOff className="h-5 w-5" />End Call
                </Button>
              </div>
              {muted && <p className="text-xs text-amber-400/80">Microphone muted</p>}
              {!ttsEnabled && <p className="text-xs text-muted-foreground/60">TTS disabled</p>}
            </div>
          )}
        </div>

        <div className="flex w-[320px] shrink-0 flex-col border-l border-border bg-card/30">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="text-sm font-medium text-foreground">Conversation Log</span>
            {messages.length > 0 && <span className="text-xs text-muted-foreground/60">{messages.length} messages</span>}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 p-4">
              {messages.length === 0 && (
                <p className="py-10 text-center text-xs text-muted-foreground/60">Conversation log will appear here</p>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                  <div className={cn("max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user" ? "rounded-tr-md bg-gradient-to-r from-rose-500 to-pink-600 text-white"
                      : "rounded-tl-md bg-secondary text-foreground ring-1 ring-border")}>
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className="h-2" />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
