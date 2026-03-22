"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ImagePlus, Sparkles, RotateCcw, ZoomIn, Shuffle, Download,
  Loader2, Heart, Copy, X, Eye, Wand2, Brush,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── seeded RNG ── */
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/* ── canvas image gen ── */
function generateImage(w: number, h: number, seed: number): string {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const rng = seededRng(seed);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "hsl(" + (rng() * 360) + "," + (40 + rng() * 30) + "%," + (15 + rng() * 20) + "%)");
  grad.addColorStop(0.5, "hsl(" + (rng() * 360) + "," + (35 + rng() * 25) + "%," + (12 + rng() * 18) + "%)");
  grad.addColorStop(1, "hsl(" + (rng() * 360) + "," + (40 + rng() * 30) + "%," + (10 + rng() * 15) + "%)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const blobCount = 6 + Math.floor(rng() * 8);
  for (let i = 0; i < blobCount; i++) {
    const x = rng() * w, y = rng() * h, r = 30 + rng() * 180;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, "hsla(" + (rng() * 360) + "," + (50 + rng() * 40) + "%," + (40 + rng() * 30) + "%," + (0.25 + rng() * 0.45) + ")");
    rg.addColorStop(1, "hsla(0,0%,0%,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(rng() * w, rng() * h);
    ctx.bezierCurveTo(rng() * w, rng() * h, rng() * w, rng() * h, rng() * w, rng() * h);
    ctx.strokeStyle = "hsla(" + (rng() * 360) + ",60%,60%," + (0.08 + rng() * 0.18) + ")";
    ctx.lineWidth = 1 + rng() * 4;
    ctx.stroke();
  }
  return c.toDataURL("image/jpeg", 0.85);
}

/* ── gallery data ── */
const GALLERY_TAGS = ["全部", "风景", "人物", "动漫", "建筑", "抽象", "科幻", "中国风"];

interface GalleryItem {
  id: number; prompt: string; tag: string; author: string;
  likes: number; views: number; model: string; style: string;
  seed: number; aspectW: number; aspectH: number;
}

const GALLERY_DATA: GalleryItem[] = [
  { id: 1, prompt: "A serene Japanese garden with cherry blossoms at sunset, warm golden light, 8k photography", tag: "风景", author: "ArtFlow", likes: 2847, views: 18420, model: "SDXL", style: "写实", seed: 10001, aspectW: 4, aspectH: 3 },
  { id: 2, prompt: "Cyberpunk girl with neon hair in a rainy Tokyo alley, cinematic lighting, ultra detailed", tag: "人物", author: "NeonDream", likes: 3521, views: 24100, model: "Flux", style: "赛博朋克", seed: 10002, aspectW: 3, aspectH: 4 },
  { id: 3, prompt: "Ancient Chinese temple in misty mountains, ink wash painting style, ethereal atmosphere", tag: "中国风", author: "InkMaster", likes: 4102, views: 31200, model: "DALL-E 3", style: "水墨", seed: 10003, aspectW: 16, aspectH: 9 },
  { id: 4, prompt: "Futuristic space station interior with holographic displays, sci-fi concept art", tag: "科幻", author: "SpaceArt", likes: 1893, views: 12800, model: "Midjourney", style: "概念艺术", seed: 10004, aspectW: 16, aspectH: 9 },
  { id: 5, prompt: "Watercolor painting of a cat napping on a windowsill, soft afternoon light", tag: "动漫", author: "CatLover", likes: 5234, views: 42100, model: "NovelAI", style: "水彩", seed: 10005, aspectW: 1, aspectH: 1 },
  { id: 6, prompt: "Northern lights over snowy mountains and a calm lake in Iceland, cinematic", tag: "风景", author: "NatureShot", likes: 3890, views: 28700, model: "SDXL", style: "写实", seed: 10006, aspectW: 16, aspectH: 9 },
  { id: 7, prompt: "Abstract fluid art with vibrant colors, gold accents, marble texture, 4k", tag: "抽象", author: "FluidArt", likes: 1567, views: 9800, model: "Flux", style: "抽象", seed: 10007, aspectW: 1, aspectH: 1 },
  { id: 8, prompt: "Gothic cathedral interior with stained glass windows, volumetric light rays", tag: "建筑", author: "ArchViz", likes: 2134, views: 15600, model: "SDXL", style: "写实", seed: 10008, aspectW: 3, aspectH: 4 },
  { id: 9, prompt: "Anime girl in a flower field, Studio Ghibli style, dreamy pastel colors", tag: "动漫", author: "GhibliFan", likes: 6721, views: 51300, model: "NovelAI", style: "动漫", seed: 10009, aspectW: 4, aspectH: 3 },
  { id: 10, prompt: "Steampunk airship flying over Victorian London, dramatic clouds, golden hour", tag: "科幻", author: "SteamPunk", likes: 2456, views: 17200, model: "Midjourney", style: "蒸汽朋克", seed: 10010, aspectW: 16, aspectH: 9 },
  { id: 11, prompt: "Traditional Chinese dragon dancing through clouds, red and gold, festival atmosphere", tag: "中国风", author: "DragonArt", likes: 3678, views: 26400, model: "DALL-E 3", style: "国潮", seed: 10011, aspectW: 3, aspectH: 4 },
  { id: 12, prompt: "Minimalist geometric landscape, pastel gradient sky, clean lines, modern art", tag: "抽象", author: "MinimalArt", likes: 1234, views: 8900, model: "Flux", style: "极简", seed: 10012, aspectW: 1, aspectH: 1 },
  { id: 13, prompt: "Underwater coral reef with tropical fish, sunlight filtering through water, photorealistic", tag: "风景", author: "OceanDeep", likes: 2987, views: 21500, model: "SDXL", style: "写实", seed: 10013, aspectW: 4, aspectH: 3 },
  { id: 14, prompt: "Cyberpunk cityscape at night, flying cars, neon signs in Chinese, rain", tag: "科幻", author: "CyberCity", likes: 4567, views: 35800, model: "Midjourney", style: "赛博朋克", seed: 10014, aspectW: 16, aspectH: 9 },
  { id: 15, prompt: "Portrait of a warrior princess, fantasy armor, dramatic lighting, oil painting style", tag: "人物", author: "FantasyArt", likes: 3210, views: 23400, model: "SDXL", style: "油画", seed: 10015, aspectW: 3, aspectH: 4 },
  { id: 16, prompt: "Zen rock garden with raked sand patterns, morning mist, peaceful atmosphere", tag: "风景", author: "ZenGarden", likes: 1876, views: 13200, model: "Flux", style: "极简", seed: 10016, aspectW: 16, aspectH: 9 },
  { id: 17, prompt: "Art deco skyscraper with golden details, sunset sky, architectural visualization", tag: "建筑", author: "DecoArch", likes: 1543, views: 11200, model: "DALL-E 3", style: "装饰艺术", seed: 10017, aspectW: 3, aspectH: 4 },
  { id: 18, prompt: "Cute robot character in a garden, Pixar style, soft lighting, 3D render", tag: "动漫", author: "PixarFan", likes: 4321, views: 33600, model: "DALL-E 3", style: "3D", seed: 10018, aspectW: 1, aspectH: 1 },
  { id: 19, prompt: "Chinese ink painting of bamboo forest in rain, calligraphy style, monochrome", tag: "中国风", author: "BambooInk", likes: 2654, views: 19800, model: "Flux", style: "水墨", seed: 10019, aspectW: 3, aspectH: 4 },
  { id: 20, prompt: "Surreal floating islands with waterfalls, fantasy landscape, magical atmosphere", tag: "风景", author: "DreamScape", likes: 5678, views: 44200, model: "Midjourney", style: "奇幻", seed: 10020, aspectW: 16, aspectH: 9 },
  { id: 21, prompt: "Neon-lit ramen shop in a narrow alley, steam rising, cozy atmosphere, night", tag: "建筑", author: "RamenShop", likes: 3456, views: 25600, model: "SDXL", style: "写实", seed: 10021, aspectW: 4, aspectH: 3 },
  { id: 22, prompt: "Abstract expressionist painting, bold brushstrokes, red and black, emotional", tag: "抽象", author: "ExpressArt", likes: 987, views: 7200, model: "Flux", style: "抽象", seed: 10022, aspectW: 1, aspectH: 1 },
  { id: 23, prompt: "Samurai standing on a cliff at dawn, cherry blossom petals in wind, epic", tag: "人物", author: "SamuraiArt", likes: 4890, views: 37800, model: "Midjourney", style: "概念艺术", seed: 10023, aspectW: 3, aspectH: 4 },
  { id: 24, prompt: "Bioluminescent deep sea creatures, dark ocean, glowing tentacles, mysterious", tag: "科幻", author: "DeepSea", likes: 2345, views: 16800, model: "SDXL", style: "写实", seed: 10024, aspectW: 4, aspectH: 3 },
];

function formatNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

/* ── Gallery Waterfall ── */
function GalleryView({ onUsePrompt }: { onUsePrompt: (p: string) => void }) {
  const [tag, setTag] = useState("全部");
  const [viewing, setViewing] = useState<GalleryItem | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [imgMap, setImgMap] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    // generate images in batches to avoid blocking main thread
    let cancelled = false;
    const items = [...GALLERY_DATA];
    const map = new Map<number, string>();
    let i = 0;
    function batch() {
      if (cancelled) return;
      const end = Math.min(i + 4, items.length);
      for (; i < end; i++) {
        const item = items[i];
        const w = 400, h = Math.round(400 * item.aspectH / item.aspectW);
        map.set(item.id, generateImage(w, h, item.seed));
      }
      setImgMap(new Map(map));
      if (i < items.length) requestAnimationFrame(batch);
    }
    requestAnimationFrame(batch);
    return () => { cancelled = true; };
  }, []);

  const mounted = imgMap.size > 0;

  const filtered = tag === "全部" ? GALLERY_DATA : GALLERY_DATA.filter((g) => g.tag === tag);

  // 分 3 列瀑布流
  const columns = useMemo(() => {
    const cols: GalleryItem[][] = [[], [], []];
    const heights = [0, 0, 0];
    filtered.forEach((item) => {
      const minIdx = heights.indexOf(Math.min(...heights));
      cols[minIdx].push(item);
      heights[minIdx] += item.aspectH / item.aspectW;
    });
    return cols;
  }, [filtered]);

  const toggleLike = useCallback((id: number) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <>
      {/* 标签筛选 */}
      <div className="flex items-center gap-2 border-b border-border px-6 py-3">
        {GALLERY_TAGS.map((t) => (
          <button key={t} onClick={() => setTag(t)}
            className={cn("rounded-full px-3.5 py-1.5 text-xs transition-all",
              tag === t ? "bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/30 font-medium" : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary")}>
            {t}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground/50">{filtered.length} 作品</span>
      </div>

      {/* 瀑布流 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex gap-3 p-4">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-1 flex-col gap-3">
              {col.map((item) => {
                const liked = likedIds.has(item.id);
                const src = mounted ? (imgMap.get(item.id) ?? "") : "";
                return (
                  <div key={item.id}
                    className="group relative overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-pink-500/20 hover:shadow-lg hover:shadow-pink-500/5 cursor-pointer"
                    onClick={() => setViewing(item)}>
                    {src && (
                      <img src={src} alt={item.prompt.slice(0, 30)}
                        className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        style={{ aspectRatio: item.aspectW + "/" + item.aspectH }} />
                    )}
                    {!src && (
                      <div className="flex items-center justify-center bg-secondary/30"
                        style={{ aspectRatio: item.aspectW + "/" + item.aspectH }}>
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/30" />
                      </div>
                    )}
                    {/* overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 opacity-0 transition-opacity group-hover:opacity-100">
                      <p className="line-clamp-2 text-xs leading-relaxed text-white/90">{item.prompt}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[10px] text-white/60">
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatNum(item.views)}</span>
                          <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{formatNum(item.likes + (liked ? 1 : 0))}</span>
                        </div>
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-white/50">{item.model}</span>
                      </div>
                    </div>
                    {/* 风格标签 */}
                    <div className="absolute left-2 top-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.style}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* 大图弹窗 */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setViewing(null)}>
          <div className="relative flex max-h-[90vh] max-w-[900px] overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex min-w-0 flex-1 items-center justify-center bg-black/20 p-4">
              {mounted && <img src={imgMap.get(viewing.id) ?? ""} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />}
            </div>
            <div className="flex w-[300px] shrink-0 flex-col border-l border-border p-5">
              <button onClick={() => setViewing(null)} className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xs font-bold text-white">
                  {viewing.author[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{viewing.author}</p>
                  <p className="text-[10px] text-muted-foreground">{viewing.model} · {viewing.style}</p>
                </div>
              </div>
              <p className="mb-4 text-sm leading-relaxed text-foreground/80">{viewing.prompt}</p>
              <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatNum(viewing.views)}</span>
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatNum(viewing.likes)}</span>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{viewing.tag}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{viewing.style}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{viewing.model}</span>
                <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{viewing.aspectW}:{viewing.aspectH}</span>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <Button onClick={() => { onUsePrompt(viewing.prompt); setViewing(null); }}
                  className="w-full gap-2 bg-gradient-to-r from-pink-500 to-rose-600 text-sm">
                  <Wand2 className="h-4 w-4" /> 使用此 Prompt 创作
                </Button>
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(viewing.prompt); }}
                  className="w-full gap-2 text-sm">
                  <Copy className="h-4 w-4" /> 复制 Prompt
                </Button>
                <Button variant="outline" onClick={() => toggleLike(viewing.id)}
                  className={cn("w-full gap-2 text-sm", likedIds.has(viewing.id) && "border-pink-500/30 text-pink-400")}>
                  <Heart className={cn("h-4 w-4", likedIds.has(viewing.id) && "fill-pink-400")} />
                  {likedIds.has(viewing.id) ? "已收藏" : "收藏"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Creation Workspace ── */
interface GenResult {
  id: string; prompt: string; images: string[];
  selectedIdx: number | null; upscaled: string | null;
  timestamp: number; seed: number;
}

const SAMPLE_PROMPTS = [
  "A serene Japanese garden with cherry blossoms at sunset, warm golden light, 8k",
  "Northern lights over snowy mountains and a calm lake in Iceland, cinematic",
  "Cyberpunk neon-lit street at night with rain reflections, ultra detailed",
  "Watercolor painting of a cat napping on a windowsill, soft light",
  "Futuristic space station interior with holographic displays, sci-fi concept art",
  "Ancient Chinese temple in misty mountains, ink wash painting style",
];
const STYLES = ["写实", "动漫", "油画", "水彩", "赛博朋克", "极简"];
const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:2"];

function CreateView({ initialPrompt }: { initialPrompt: string }) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [style, setStyle] = useState("写实");
  const [ratio, setRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<GenResult[]>([]);
  const [activeResult, setActiveResult] = useState<GenResult | null>(null);
  const [viewingFull, setViewingFull] = useState<string | null>(null);
  const abortRef = useRef(false);

  const generate = useCallback(async (inputPrompt?: string) => {
    const p = inputPrompt ?? prompt;
    if (!p.trim() || isGenerating) return;
    abortRef.current = false;
    setIsGenerating(true); setProgress(0);
    const seed = Date.now();
    for (let i = 0; i <= 100; i += 5) {
      if (abortRef.current) break;
      setProgress(i);
      await new Promise((r) => setTimeout(r, 80));
    }
    if (!abortRef.current) {
      const images = [0, 1, 2, 3].map((i) => generateImage(512, 512, seed + i * 9973));
      const result: GenResult = { id: seed.toString(), prompt: p, images, selectedIdx: null, upscaled: null, timestamp: Date.now(), seed };
      setResults((prev) => [result, ...prev].slice(0, 10));
      setActiveResult(result);
    }
    setIsGenerating(false); setProgress(0);
  }, [prompt, isGenerating]);

  const handleVariation = useCallback((result: GenResult, idx: number) => {
    const newSeed = result.seed + idx * 31337 + Date.now();
    const images = [0, 1, 2, 3].map((i) => generateImage(512, 512, newSeed + i * 9973));
    const nr: GenResult = { id: newSeed.toString(), prompt: result.prompt + " (变体)", images, selectedIdx: null, upscaled: null, timestamp: Date.now(), seed: newSeed };
    setResults((prev) => [nr, ...prev].slice(0, 10));
    setActiveResult(nr);
  }, []);

  const handleUpscale = useCallback((result: GenResult, idx: number) => {
    const upscaled = generateImage(1024, 1024, result.seed + idx * 7777);
    const updated = { ...result, selectedIdx: idx, upscaled };
    setResults((prev) => prev.map((r) => r.id === result.id ? updated : r));
    setActiveResult(updated);
  }, []);

  return (
    <div className="flex min-h-0 flex-1">
      {/* 左侧参数 */}
      <ScrollArea className="w-[280px] shrink-0 border-r border-border">
        <div className="flex flex-col gap-5 p-5">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} disabled={isGenerating}
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
              placeholder="描述你想生成的图片..." />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">快捷 Prompt</label>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sp, i) => (
                <button key={i} onClick={() => setPrompt(sp)}
                  className={cn("rounded-lg px-2.5 py-1.5 text-xs text-left transition-all",
                    prompt === sp ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {sp.slice(0, 25)}...
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
                    style === s ? "bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">画面比例</label>
            <div className="flex flex-wrap gap-1.5">
              {RATIOS.map((r) => (
                <button key={r} onClick={() => setRatio(r)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs transition-all",
                    ratio === r ? "bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/30" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={() => generate()} disabled={!prompt.trim() || isGenerating}
            className="w-full gap-2 bg-gradient-to-r from-pink-500 to-rose-600 shadow-md shadow-pink-500/20">
            {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin" />生成中 {progress}%</> : <><Sparkles className="h-4 w-4" />生成图片</>}
          </Button>
          {isGenerating && (
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-200" style={{ width: progress + "%" }} />
            </div>
          )}
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              <span className="text-xs font-medium text-foreground">产品形态</span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Prompt → 4 宫格候选 → 选择放大/变体 → 迭代优化。代表产品：Midjourney、DALL-E、即梦、通义万相。
            </p>
          </div>
        </div>
      </ScrollArea>

      {/* 中间主展示区 */}
      <div className="flex min-w-0 flex-1 flex-col p-6">
        {activeResult ? (
          <>
            {!activeResult.upscaled ? (
              <div className="grid flex-1 grid-cols-2 gap-3">
                {activeResult.images.map((img, idx) => (
                  <div key={idx} className="group relative overflow-hidden rounded-xl border border-border bg-card">
                    <img src={img} alt={"候选 " + (idx + 1)} className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => handleUpscale(activeResult, idx)}
                        className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-white/25">
                        <ZoomIn className="h-3.5 w-3.5" /> 放大
                      </button>
                      <button onClick={() => handleVariation(activeResult, idx)}
                        className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-white/25">
                        <Shuffle className="h-3.5 w-3.5" /> 变体
                      </button>
                    </div>
                    <div className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="group relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-card">
                <img src={activeResult.upscaled} alt="放大图" className="max-h-full max-w-full cursor-pointer object-contain"
                  onClick={() => setViewingFull(activeResult.upscaled)} />
                <div className="absolute right-3 top-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => { setActiveResult({ ...activeResult, upscaled: null, selectedIdx: null }); }}
                    className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/70">
                    <RotateCcw className="h-3.5 w-3.5" /> 返回 4 宫格
                  </button>
                  <button className="flex items-center gap-1.5 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur-sm hover:bg-black/70">
                    <Download className="h-3.5 w-3.5" /> 下载
                  </button>
                </div>
                <div className="absolute left-3 top-3 rounded-md bg-black/50 px-2.5 py-1 text-xs text-white/70 backdrop-blur-sm">
                  1024 x 1024 · 已放大
                </div>
              </div>
            )}
            <div className="mt-3 rounded-xl border border-border bg-card/50 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Prompt:</span> {activeResult.prompt}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/20">
              <ImagePlus className="h-10 w-10 text-pink-400/50" />
            </div>
            <p className="text-foreground">输入 Prompt 开始生成</p>
            <p className="text-sm text-muted-foreground">每次生成 4 张候选图，可放大或生成变体</p>
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
              <button key={r.id} onClick={() => setActiveResult(r)}
                className={cn("rounded-xl border p-2 text-left transition-all",
                  activeResult?.id === r.id ? "border-pink-500/30 bg-pink-500/5" : "border-border hover:border-border/80")}>
                <div className="grid grid-cols-2 gap-1">
                  {r.images.slice(0, 4).map((img, i) => (
                    <img key={i} src={img} alt="" className="aspect-square w-full rounded-md object-cover" />
                  ))}
                </div>
                <p className="mt-1.5 truncate text-[10px] text-muted-foreground">{r.prompt}</p>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {viewingFull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setViewingFull(null)}>
          <img src={viewingFull} alt="全屏" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */
type Tab = "gallery" | "create";

export default function ImageGenPage() {
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-md shadow-pink-500/20">
              <ImagePlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">AI 图片生成</h1>
              <p className="text-sm text-muted-foreground">灵感广场 + Midjourney 创作工作台</p>
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
              <Brush className="h-4 w-4" /> 创作工作台
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
