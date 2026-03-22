"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Video, Play, Pause, Sparkles, RotateCcw, Download,
  Loader2, Eye, Wand2, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── seeded RNG ── */
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* ── canvas frame generator (simulates a video frame) ── */
function generateFrame(w: number, h: number, seed: number, t: number): string {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const rng = seededRng(seed);

  // animated gradient background
  const hueShift = t * 30;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${(rng() * 360 + hueShift) % 360},${40 + rng() * 25}%,${12 + rng() * 15}%)`);
  grad.addColorStop(0.5, `hsl(${(rng() * 360 + hueShift + 60) % 360},${35 + rng() * 20}%,${10 + rng() * 12}%)`);
  grad.addColorStop(1, `hsl(${(rng() * 360 + hueShift + 120) % 360},${40 + rng() * 25}%,${8 + rng() * 10}%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // moving blobs
  for (let i = 0; i < 5; i++) {
    const bx = (rng() * w + Math.sin(t * 0.5 + i) * 80) % w;
    const by = (rng() * h + Math.cos(t * 0.3 + i) * 60) % h;
    const r = 40 + rng() * 120;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    rg.addColorStop(0, `hsla(${(rng() * 360 + hueShift) % 360},55%,45%,${0.3 + rng() * 0.3})`);
    rg.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  }

  return c.toDataURL("image/jpeg", 0.8);
}

function generateThumbnail(w: number, h: number, seed: number): string {
  return generateFrame(w, h, seed, 0);
}

/* ── Gallery data ── */
const GALLERY_TAGS = ["全部", "风景", "人物", "动画", "科幻", "广告", "教程"];

interface GalleryVideo {
  id: number; prompt: string; tag: string; author: string;
  likes: number; views: number; model: string; duration: string;
  resolution: string; seed: number;
}

const GALLERY_DATA: GalleryVideo[] = [
  { id: 1, prompt: "A drone shot flying over misty mountains at sunrise, cinematic, slow motion", tag: "风景", author: "SkyView", likes: 3421, views: 28900, model: "Sora", duration: "4s", resolution: "1080p", seed: 20001 },
  { id: 2, prompt: "A young woman walking through a neon-lit Tokyo street at night, rain reflections", tag: "人物", author: "NeonDream", likes: 5102, views: 41200, model: "Runway Gen-3", duration: "6s", resolution: "1080p", seed: 20002 },
  { id: 3, prompt: "3D animated character dancing in a colorful candy world, Pixar style", tag: "动画", author: "PixarFan", likes: 4567, views: 35600, model: "Pika", duration: "4s", resolution: "720p", seed: 20003 },
  { id: 4, prompt: "Spaceship entering a wormhole with swirling galaxies, epic sci-fi, 4K", tag: "科幻", author: "SpaceArt", likes: 2890, views: 22100, model: "Sora", duration: "8s", resolution: "4K", seed: 20004 },
  { id: 5, prompt: "Product showcase: a luxury watch rotating on a marble surface, studio lighting", tag: "广告", author: "AdStudio", likes: 1876, views: 15400, model: "Runway Gen-3", duration: "6s", resolution: "1080p", seed: 20005 },
  { id: 6, prompt: "Ocean waves crashing on volcanic rocks, golden hour, slow motion, aerial view", tag: "风景", author: "OceanDeep", likes: 4231, views: 33800, model: "可灵", duration: "4s", resolution: "1080p", seed: 20006 },
  { id: 7, prompt: "A samurai drawing his sword in a bamboo forest, cherry blossoms falling, cinematic", tag: "人物", author: "SamuraiArt", likes: 6789, views: 52300, model: "Sora", duration: "6s", resolution: "4K", seed: 20007 },
  { id: 8, prompt: "Cute robot learning to paint on canvas, warm studio light, 3D animation", tag: "动画", author: "RoboArt", likes: 3456, views: 27800, model: "Pika", duration: "4s", resolution: "720p", seed: 20008 },
  { id: 9, prompt: "Cyberpunk city timelapse, flying cars, holographic billboards, rain", tag: "科幻", author: "CyberCity", likes: 5678, views: 44100, model: "Runway Gen-3", duration: "8s", resolution: "1080p", seed: 20009 },
  { id: 10, prompt: "Step-by-step tutorial: making latte art, top-down camera, smooth transitions", tag: "教程", author: "CoffeeLab", likes: 2345, views: 18900, model: "可灵", duration: "10s", resolution: "1080p", seed: 20010 },
  { id: 11, prompt: "Northern lights dancing over a frozen lake in Iceland, timelapse, 4K", tag: "风景", author: "AuroraShot", likes: 7890, views: 61200, model: "Sora", duration: "6s", resolution: "4K", seed: 20011 },
  { id: 12, prompt: "Fashion model walking on a runway, dramatic lighting, slow motion close-up", tag: "人物", author: "FashionAI", likes: 3210, views: 25600, model: "Runway Gen-3", duration: "4s", resolution: "1080p", seed: 20012 },
  { id: 13, prompt: "Animated explainer: how neural networks learn, motion graphics, clean design", tag: "教程", author: "EduMotion", likes: 4321, views: 34500, model: "Pika", duration: "12s", resolution: "1080p", seed: 20013 },
  { id: 14, prompt: "A sports car drifting on a mountain road, dust clouds, cinematic angles", tag: "广告", author: "AutoViz", likes: 5432, views: 43200, model: "可灵", duration: "6s", resolution: "4K", seed: 20014 },
  { id: 15, prompt: "Underwater scene: a whale swimming through bioluminescent jellyfish, dreamlike", tag: "科幻", author: "DeepSea", likes: 6543, views: 51800, model: "Sora", duration: "8s", resolution: "4K", seed: 20015 },
  { id: 16, prompt: "Traditional Chinese ink painting coming to life, mountains and rivers flowing", tag: "动画", author: "InkMotion", likes: 4567, views: 36700, model: "可灵", duration: "6s", resolution: "1080p", seed: 20016 },
];

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/* ── Gallery View ── */
function GalleryView({ onUsePrompt }: { onUsePrompt: (p: string) => void }) {
  const [tag, setTag] = useState("全部");
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const items = [...GALLERY_DATA];
    const map = new Map<number, string>();
    let i = 0;
    function batch() {
      if (cancelled) return;
      const end = Math.min(i + 4, items.length);
      for (; i < end; i++) {
        map.set(items[i].id, generateThumbnail(320, 180, items[i].seed));
      }
      setThumbs(new Map(map));
      if (i < items.length) requestAnimationFrame(batch);
    }
    requestAnimationFrame(batch);
    return () => { cancelled = true; };
  }, []);

  const filtered = tag === "全部" ? GALLERY_DATA : GALLERY_DATA.filter((v) => v.tag === tag);

  return (
    <>
      {/* 标签筛选 */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        {GALLERY_TAGS.map((t) => (
          <button key={t} onClick={() => setTag(t)}
            className={cn("rounded-full px-3.5 py-1.5 text-xs transition-all",
              tag === t ? "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30 font-medium" : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary")}>
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground/50">{filtered.length} 作品</span>
      </div>

      {/* 视频网格 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid grid-cols-2 gap-4 p-5 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => {
            const src = thumbs.get(v.id) ?? "";
            return (
              <div key={v.id}
                className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer"
                onClick={() => onUsePrompt(v.prompt)}>
                <div className="relative aspect-video overflow-hidden">
                  {src ? (
                    <img src={src} alt={v.prompt.slice(0, 30)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary/30">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
                    </div>
                  )}
                  {/* play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-all group-hover:opacity-100">
                      <Play className="h-5 w-5 text-white" fill="white" />
                    </div>
                  </div>
                  {/* duration badge */}
                  <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
                    {v.duration}
                  </div>
                  {/* model badge */}
                  <div className="absolute left-2 top-2 rounded bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    {v.model}
                  </div>
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-xs leading-relaxed text-foreground/80">{v.prompt}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{v.author}</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNum(v.views)}</span>
                      <span>{v.resolution}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </>
  );
}

/* ── Create View ── */
interface GenResult {
  id: string; prompt: string; thumbnail: string;
  frames: string[]; duration: string; resolution: string;
  timestamp: number; seed: number;
}

const SAMPLE_PROMPTS = [
  "A drone shot flying over misty mountains at sunrise, cinematic",
  "A cat playing piano in a jazz bar, warm lighting, 4K",
  "Timelapse of a flower blooming in a garden, macro lens",
  "Astronaut floating in space with Earth in background, epic",
  "Ocean waves crashing on rocks, golden hour, slow motion",
  "A futuristic city at night with flying cars and neon lights",
];
const DURATIONS = ["4s", "6s", "8s", "10s"];
const RESOLUTIONS = ["720p", "1080p", "4K"];
const MOTION_LEVELS = ["低", "中", "高"];
const STYLES = ["写实", "动画", "电影", "水墨", "赛博朋克", "极简"];

function CreateView({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [duration, setDuration] = useState("4s");
  const [resolution, setResolution] = useState("1080p");
  const [motion, setMotion] = useState("中");
  const [style, setStyle] = useState("写实");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [results, setResults] = useState<GenResult[]>([]);
  const [activeResult, setActiveResult] = useState<GenResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const abortRef = useRef(false);
  const playTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const generate = useCallback(async (inputPrompt?: string) => {
    const p = inputPrompt ?? prompt;
    if (!p.trim() || isGenerating) return;
    abortRef.current = false;
    setIsGenerating(true); setProgress(0); setPhase("分析 Prompt...");

    const seed = Date.now();
    const phases = ["分析 Prompt...", "生成关键帧...", "运动插值...", "超分辨率...", "合成输出..."];
    const totalSteps = 100;

    for (let i = 0; i <= totalSteps; i += 2) {
      if (abortRef.current) break;
      setProgress(i);
      setPhase(phases[Math.min(Math.floor(i / 20), phases.length - 1)]);
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!abortRef.current) {
      const frameCount = 12;
      const frames = Array.from({ length: frameCount }, (_, i) =>
        generateFrame(640, 360, seed, i / frameCount)
      );
      const result: GenResult = {
        id: seed.toString(), prompt: p, thumbnail: frames[0],
        frames, duration, resolution, timestamp: Date.now(), seed,
      };
      setResults((prev) => [result, ...prev].slice(0, 10));
      setActiveResult(result);
    }
    setIsGenerating(false); setProgress(0); setPhase("");
  }, [prompt, isGenerating, duration, resolution]);

  // frame playback
  useEffect(() => {
    if (playing && activeResult) {
      playTimerRef.current = setInterval(() => {
        setCurrentFrame((f) => (f + 1) % (activeResult.frames.length));
      }, 200);
    }
    return () => { clearInterval(playTimerRef.current); };
  }, [playing, activeResult]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
    if (!playing) setCurrentFrame(0);
  }, [playing]);

  // cleanup on unmount
  useEffect(() => {
    return () => { clearInterval(playTimerRef.current); abortRef.current = true; };
  }, []);

  return (
    <div className="flex min-h-0 flex-1">
      {/* 左侧参数面板 */}
      <ScrollArea className="w-[280px] shrink-0 border-r border-border">
        <div className="flex flex-col gap-5 p-5">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} disabled={isGenerating}
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              placeholder="描述你想生成的视频场景..." />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">快捷 Prompt</label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sp, i) => (
                <button key={i} onClick={() => setPrompt(sp)}
                  className={cn("rounded-lg px-2.5 py-1.5 text-xs text-left transition-all",
                    prompt === sp ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {sp.slice(0, 22)}...
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">时长</label>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button key={d} onClick={() => setDuration(d)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs transition-all",
                    duration === d ? "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">分辨率</label>
            <div className="flex flex-wrap gap-1.5">
              {RESOLUTIONS.map((r) => (
                <button key={r} onClick={() => setResolution(r)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs transition-all",
                    resolution === r ? "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">运动幅度</label>
            <div className="flex flex-wrap gap-1.5">
              {MOTION_LEVELS.map((m) => (
                <button key={m} onClick={() => setMotion(m)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs transition-all",
                    motion === m ? "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">风格</label>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button key={s} onClick={() => setStyle(s)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs transition-all",
                    style === s ? "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => generate()} disabled={!prompt.trim() || isGenerating}
            className="w-full gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20">
            {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" />{phase} {progress}%</> : <><Sparkles className="h-4 w-4" />生成视频</>}
          </Button>
          {isGenerating && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-200" style={{ width: progress + "%" }} />
              </div>
              <p className="text-center text-[10px] text-muted-foreground/60">{phase}</p>
            </div>
          )}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <span className="text-xs font-medium text-foreground">产品形态</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {"Prompt → 关键帧生成 → 运动插值 → 超分输出。代表产品：Sora、Runway Gen-3、可灵、Pika。"}
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* 中间预览区 */}
      <div className="flex min-w-0 flex-1 flex-col p-6">
        {activeResult ? (
          <>
            <div className="group relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-black/20">
              <img
                src={activeResult.frames[currentFrame] ?? activeResult.thumbnail}
                alt="视频预览"
                className="max-h-full max-w-full object-contain"
              />
              {/* 播放控制 */}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
                <button onClick={togglePlay}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 transition-colors">
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="white" />}
                </button>
                {/* 帧进度条 */}
                <div className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-400 transition-all duration-150"
                    style={{ width: `${((currentFrame + 1) / activeResult.frames.length) * 100}%` }} />
                </div>
                <span className="text-[11px] text-white/60 font-mono">
                  {currentFrame + 1}/{activeResult.frames.length}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{activeResult.duration}</span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{activeResult.resolution}</span>
              </div>
              {/* 关键帧时间线 */}
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/70">
                  <Download className="h-3.5 w-3.5" /> 下载
                </button>
                <button onClick={() => { setPlaying(false); setCurrentFrame(0); }}
                  className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/70">
                  <RotateCcw className="h-3.5 w-3.5" /> 重置
                </button>
              </div>
            </div>
            {/* 关键帧缩略图 */}
            <div className="mt-3 flex gap-2 overflow-x-auto rounded-xl border border-border bg-card/50 p-3">
              {activeResult.frames.map((frame, i) => (
                <button key={i} onClick={() => { setCurrentFrame(i); setPlaying(false); }}
                  className={cn("shrink-0 overflow-hidden rounded-lg border-2 transition-all",
                    i === currentFrame ? "border-violet-400 shadow-md shadow-violet-500/20" : "border-transparent opacity-60 hover:opacity-100")}>
                  <img src={frame} alt={`帧 ${i + 1}`} className="h-12 w-20 object-cover" />
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-border bg-card/50 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Prompt:</span> {activeResult.prompt}
              </p>
            </div>
          </>
        ) : isGenerating ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
            <div className="relative flex h-32 w-32 items-center justify-center">
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-400" style={{ animationDuration: "2s" }} />
              <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-indigo-400" style={{ animationDuration: "3s", animationDirection: "reverse" }} />
              <Film className="h-10 w-10 text-violet-400/50" />
            </div>
            <div className="text-center">
              <p className="text-foreground">{phase}</p>
              <p className="mt-1 text-sm text-muted-foreground">{progress}% 完成</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20">
              <Video className="h-10 w-10 text-violet-400/50" />
            </div>
            <p className="text-foreground">输入 Prompt 开始生成视频</p>
            <p className="text-sm text-muted-foreground">AI 将生成关键帧并进行运动插值</p>
          </div>
        )}
      </div>

      {/* 右侧历史 */}
      <div className="flex w-[200px] shrink-0 flex-col border-l border-border bg-card/30">
        <div className="border-b border-border px-4 py-3">
          <span className="text-xs font-medium text-muted-foreground">生成历史</span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-2">
            {results.length === 0 && <p className="py-8 text-center text-[11px] text-muted-foreground/50">暂无记录</p>}
            {results.map((r) => (
              <button key={r.id} onClick={() => { setActiveResult(r); setPlaying(false); setCurrentFrame(0); }}
                className={cn("rounded-xl border p-2 text-left transition-all",
                  activeResult?.id === r.id ? "border-violet-500/30 bg-violet-500/5" : "border-border hover:border-border/80")}>
                <div className="relative aspect-video overflow-hidden rounded-lg">
                  <img src={r.thumbnail} alt="" className="h-full w-full object-cover" />
                  <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.5 text-[9px] text-white/70">{r.duration}</div>
                </div>
                <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{r.prompt}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

/* ── Main Page ── */
type Tab = "gallery" | "create";

export default function VideoGenPage() {
  const [tab, setTab] = useState<Tab>("gallery");
  const [promptFromGallery, setPromptFromGallery] = useState("");

  const handleUsePrompt = useCallback((p: string) => {
    setPromptFromGallery(p);
    setTab("create");
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header + Tabs */}
      <div className="shrink-0 border-b border-border px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20">
              <Video className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">AI 视频生成</h1>
              <p className="text-sm text-muted-foreground">灵感广场 + Sora 风格创作工作台</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
            <button onClick={() => setTab("gallery")}
              className={cn("flex items-center gap-1.5 rounded-md px-4 py-2 text-sm transition-all",
                tab === "gallery" ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
              <Eye className="h-4 w-4" /> 灵感广场
            </button>
            <button onClick={() => setTab("create")}
              className={cn("flex items-center gap-1.5 rounded-md px-4 py-2 text-sm transition-all",
                tab === "create" ? "bg-card text-foreground shadow-sm font-medium" : "text-muted-foreground hover:text-foreground")}>
              <Wand2 className="h-4 w-4" /> 创作工作台
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "gallery" ? (
          <GalleryView onUsePrompt={handleUsePrompt} />
        ) : (
          <CreateView key={promptFromGallery} initialPrompt={promptFromGallery} />
        )}
      </div>
    </div>
  );
}
