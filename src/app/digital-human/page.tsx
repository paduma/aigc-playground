"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ScanFace, Play, Sparkles, ChevronRight,
  Volume2, VolumeX, Settings2, CircleStop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { speak, stopSpeaking, preloadVoices, getEnglishVoices } from "@/lib/use-tts";

interface FaceParams {
  headYaw: number; headPitch: number;
  eyeLeftOpen: number; eyeRightOpen: number;
  mouthOpen: number; mouthSmile: number;
  browLeftUp: number; browRightUp: number;
}

function randomFaceParams(t: number): FaceParams {
  return {
    headYaw: Math.sin(t * 0.8) * 15,
    headPitch: Math.sin(t * 0.5 + 1) * 8,
    eyeLeftOpen: 0.8 + Math.sin(t * 3) * 0.15,
    eyeRightOpen: 0.8 + Math.sin(t * 3 + 0.1) * 0.15,
    mouthOpen: Math.abs(Math.sin(t * 4)) * 0.6,
    mouthSmile: 0.3 + Math.sin(t * 0.7) * 0.3,
    browLeftUp: 0.3 + Math.sin(t * 1.2) * 0.2,
    browRightUp: 0.3 + Math.sin(t * 1.2 + 0.5) * 0.2,
  };
}

const BASE = process.env.NODE_ENV === "production" ? "/aigc-playground" : "";
const AVATAR_SRC = `${BASE}/avatar-cartoon-3d.jpg`;

const SCRIPTS = [
  { text: "Hey, welcome to the AIGC Playground! I'm Yue, your digital host, here to give you a quick tour.", duration: 5000 },
  { text: "This Playground showcases mainstream AI product interaction patterns. Each page represents a different product mode.", duration: 5500 },
  { text: "For example, smart chat, RAG knowledge Q&A, AI voice calls, video understanding, image generation, and expert agents.", duration: 5500 },
  { text: "You can freely switch between pages using the sidebar. Each one is a standalone experience with different interaction styles.", duration: 5000 },
  { text: "And I myself am one of those patterns — a digital human livestream. Hope this inspires you. Enjoy exploring!", duration: 5500 },
];

export default function DigitalHumanPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentScript, setCurrentScript] = useState(-1);
  const [subtitle, setSubtitle] = useState("");
  const [faceParams, setFaceParams] = useState<FaceParams>(randomFaceParams(0));
  const [muted, setMuted] = useState(false);
  const [frame, setFrame] = useState(0);
  const [showPanel, setShowPanel] = useState(true);
  const [voiceName, setVoiceName] = useState<string>("");
  const [voices, setVoices] = useState<{ name: string; lang: string }[]>([]);

  const animRef = useRef<number>(0);
  const abortRef = useRef(false);
  const playingRef = useRef(false); // ref 守卫，避免 stale closure
  const mutedRef = useRef(false);
  const resumeSpeakRef = useRef<(() => void) | null>(null);

  useEffect(() => { preloadVoices().then(() => setVoices(getEnglishVoices())); }, []);

  // 组件卸载时停止一切
  useEffect(() => {
    return () => {
      abortRef.current = true;
      cancelAnimationFrame(animRef.current);
      stopSpeaking();
      resumeSpeakRef.current = null;
      playingRef.current = false;
    };
  }, []);

  // 同步 mutedRef，静音时立即停止当前 TTS；取消静音时恢复播报
  useEffect(() => {
    mutedRef.current = muted;
    if (muted) {
      stopSpeaking();
    } else if (playingRef.current && resumeSpeakRef.current) {
      // 取消静音 → 恢复当前段 TTS
      resumeSpeakRef.current();
      resumeSpeakRef.current = null;
    }
  }, [muted]);

  /** 朗读一段台词。muted 时不发声，取消静音后自动恢复当前段 */
  const speakScript = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      // 如果已经 abort，直接 resolve 避免 Promise 泄漏
      if (abortRef.current) { resolve(); return; }

      if (mutedRef.current) {
        // 静音时用 duration 超时自动 resolve，避免 Promise 永远挂起
        const timer = setTimeout(resolve, 5000);
        resumeSpeakRef.current = () => {
          clearTimeout(timer);
          speak(text, {
            lang: "en-US",
            rate: 1.0,
            voiceName: voiceName || undefined,
            onEnd: resolve,
          });
        };
        return;
      }

      let cancelled = false;
      resumeSpeakRef.current = null;

      speak(text, {
        lang: "en-US",
        rate: 1.0,
        voiceName: voiceName || undefined,
        onEnd: () => {
          if (mutedRef.current && !cancelled) {
            cancelled = true;
            resumeSpeakRef.current = () => {
              speak(text, {
                lang: "en-US",
                rate: 1.0,
                voiceName: voiceName || undefined,
                onEnd: resolve,
              });
            };
            return;
          }
          resolve();
        },
      });
    });
  }, [voiceName]);

  const startPerformance = useCallback(async () => {
    // 用 ref 做守卫，彻底避免 stale closure
    if (playingRef.current) return;
    playingRef.current = true;
    abortRef.current = false;
    setIsPlaying(true);
    setFrame(0);

    let t = 0;
    const animate = () => {
      if (abortRef.current) return;
      t += 0.05;
      setFaceParams(randomFaceParams(t));
      setFrame((f) => f + 1);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    for (let i = 0; i < SCRIPTS.length; i++) {
      if (abortRef.current) break;
      setCurrentScript(i);
      setSubtitle(SCRIPTS[i].text);

      let ttsFinished = false;
      speakScript(SCRIPTS[i].text).then(() => { ttsFinished = true; });

      // 等待 TTS 完成或 duration 超时（取较长者，但有上限）
      let elapsed = 0;
      const maxWait = SCRIPTS[i].duration + 5000;
      while (!ttsFinished && elapsed < maxWait) {
        if (abortRef.current) break;
        await new Promise((r) => setTimeout(r, 100));
        elapsed += 100;
      }
      // 进入下一段前清理恢复回调，避免取消静音时触发过期段
      resumeSpeakRef.current = null;
    }

    // 正常播完或被 abort
    abortRef.current = true;
    cancelAnimationFrame(animRef.current);
    playingRef.current = false;
    setIsPlaying(false);
    setCurrentScript(-1);
    setSubtitle("");
  }, [speakScript]);

  const stopPerformance = useCallback(() => {
    abortRef.current = true;
    cancelAnimationFrame(animRef.current);
    stopSpeaking();
    resumeSpeakRef.current = null;
    playingRef.current = false;
    setIsPlaying(false);
    setCurrentScript(-1);
    setSubtitle("");
  }, []);

  const isLive = isPlaying && currentScript >= 0;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, oklch(0.16 0.02 260), oklch(0.13 0.015 280), oklch(0.11 0.01 300))" }}>
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* 头像区域 */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className={cn(
            "relative rounded-full p-1 transition-all duration-700",
            isLive ? "shadow-[0_0_60px_rgba(99,102,241,0.4),0_0_120px_rgba(99,102,241,0.15)]" : "shadow-[0_0_30px_rgba(99,102,241,0.15)]"
          )}>
            <div className={cn("absolute -inset-2 rounded-full border transition-all duration-500", isLive ? "border-indigo-400/40 animate-[spin_8s_linear_infinite]" : "border-indigo-400/10")} />
            <div className={cn("absolute -inset-4 rounded-full border transition-all duration-500", isLive ? "border-violet-400/20 animate-[spin_12s_linear_infinite_reverse]" : "border-transparent")} />
            <div className="w-64 h-64 rounded-full overflow-hidden border-2 border-indigo-400/30 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AVATAR_SRC} alt="Digital Human Host" className="w-full h-full object-cover transition-transform duration-100"
                style={{ transform: `rotateY(${faceParams.headYaw * 0.3}deg) rotateX(${faceParams.headPitch * -0.3}deg) scale(${1 + faceParams.mouthOpen * 0.02})` }} />
              {isLive && !muted && (
                <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 rounded-full bg-indigo-400/20 blur-xl pointer-events-none"
                  style={{ width: `${60 + faceParams.mouthOpen * 40}px`, height: `${30 + faceParams.mouthOpen * 20}px`, opacity: 0.3 + faceParams.mouthOpen * 0.4 }} />
              )}
            </div>
          </div>

          {/* 状态徽章 */}
          <div className={cn(
            "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all",
            isLive && !muted ? "bg-indigo-500/20 text-indigo-300 border border-indigo-400/30"
              : isLive && muted ? "bg-indigo-500/10 text-indigo-300/60 border border-indigo-400/20"
                : "bg-white/5 text-white/40 border border-white/10"
          )}>
            <span className={cn("w-2 h-2 rounded-full",
              isLive && !muted ? "bg-indigo-400 animate-pulse"
                : isLive && muted ? "bg-indigo-400/50"
                  : "bg-white/30")} />
            {isLive && !muted ? "LIVE" : isLive && muted ? "LIVE · Muted" : "Standby"}
          </div>
        </div>

        {/* 字幕 */}
        {subtitle && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 max-w-lg">
            <div className="bg-black/60 backdrop-blur-md rounded-xl px-6 py-3 border border-white/10">
              <p className="text-white/90 text-sm text-center leading-relaxed">{subtitle}</p>
            </div>
          </div>
        )}

        {/* 控制栏：Go Live / End Live + Mute + Settings */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
          {!isPlaying ? (
            <Button onClick={startPerformance} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full px-6">
              <Play className="w-4 h-4" /> Go Live
            </Button>
          ) : (
            <Button onClick={stopPerformance} className="gap-2 rounded-full bg-red-600 hover:bg-red-500 text-white px-5">
              <CircleStop className="w-4 h-4" /> End Live
            </Button>
          )}
          <Button onClick={() => setMuted(!muted)} variant="ghost" size="icon"
            className={cn("rounded-full hover:bg-white/10",
              muted ? "text-amber-400 bg-amber-500/10 ring-1 ring-amber-400/30" : "text-white/60 hover:text-white"
            )}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button onClick={() => setShowPanel(!showPanel)} variant="ghost" size="icon" className="rounded-full text-white/60 hover:text-white hover:bg-white/10">
            <Settings2 className="w-4 h-4" />
          </Button>
        </div>

        {isPlaying && <div className="absolute top-4 right-4 z-20 text-[10px] text-white/30 font-mono">Frame {frame}</div>}
      </div>

      {/* 右侧面板 */}
      {showPanel && (
        <div className="w-80 shrink-0 border-l border-white/10 bg-card/50 flex flex-col min-h-0">
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4 space-y-5">
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5" /> Voice
                </h3>
                <CustomSelect
                  value={voiceName}
                  onChange={setVoiceName}
                  placeholder="Auto"
                  options={[
                    { value: "", label: "Auto" },
                    ...voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` })),
                  ]}
                />
                <button
                  type="button"
                  onClick={() => speak("Hi, I'm Yue!", { lang: "en-US", voiceName: voiceName || undefined, rate: 1.0 })}
                  className="mt-2 w-full text-xs text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-400/20 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Preview Voice
                </button>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ScanFace className="w-3.5 h-3.5" /> Blendshape 参数
                </h3>
                <div className="space-y-2">
                  {Object.entries(faceParams).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-24 truncate font-mono">{key}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500/60 rounded-full transition-all duration-100"
                          style={{ width: `${Math.min(100, Math.abs(val as number) * (key.includes("head") ? 3 : 100))}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 w-10 text-right font-mono">{(val as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> About
                </h3>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3 space-y-2 text-xs text-muted-foreground">
                  <p>Digital human livestreaming is a core AIGC application in e-commerce, brand marketing, and online education.</p>
                  <p>In production, avatars are AI-generated (e.g. HeyGen, Synthesia) with LLM-powered real-time scripts.</p>
                  <p>This demo simulates the frontend layer: Blendshape params + browser TTS, pure frontend, zero backend.</p>
                </div>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">Tech Highlights</h3>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {["52 ARKit Blendshape params", "requestAnimationFrame animation", "Web Speech API TTS", "CSS transform driven by params", "Bandwidth < 1KB/s (params only)"].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <ChevronRight className="w-3 h-3 mt-0.5 text-indigo-400/60 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-3">Script</h3>
                <div className="space-y-1.5">
                  {SCRIPTS.map((s, i) => (
                    <div key={i} className={cn(
                      "text-xs px-3 py-2 rounded-lg border transition-all",
                      i === currentScript ? "bg-indigo-500/15 border-indigo-400/30 text-indigo-200" : "bg-white/[0.02] border-white/[0.05] text-muted-foreground"
                    )}>
                      <span className="text-[10px] text-muted-foreground/50 mr-1.5">#{i + 1}</span>
                      {s.text}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
