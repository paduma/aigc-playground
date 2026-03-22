"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Film, Play, Pause, Send, MessageSquare, Sparkles,
  Square, FileText, Captions, ImageIcon, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { mockSSEStream } from "@/lib/mock-sse";
import { MarkdownContent } from "@/components/chat/markdown-content";

/* ── 时间线事件 ── */
interface TimelineEvent {
  time: number;
  label: string;
  type: "scene" | "action" | "object";
  detail: string;
}

const MOCK_TIMELINE: TimelineEvent[] = [
  { time: 0, label: "开场", type: "scene", detail: "室内办公场景，自然光" },
  { time: 3, label: "人物出现", type: "object", detail: "检测到 1 人，正面朝向镜头" },
  { time: 5, label: "手势", type: "action", detail: "演讲手势，双手展开" },
  { time: 8, label: "场景切换", type: "scene", detail: "切换到产品特写镜头" },
  { time: 12, label: "文字叠加", type: "object", detail: "检测到屏幕文字：'核心功能'" },
  { time: 15, label: "动作", type: "action", detail: "手指指向屏幕，引导注意力" },
  { time: 18, label: "场景切换", type: "scene", detail: "回到演讲者，中景" },
  { time: 22, label: "结束", type: "scene", detail: "品牌 Logo 展示，淡出" },
];

const TYPE_COLORS: Record<string, string> = {
  scene: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  action: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  object: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};
const TYPE_LABELS: Record<string, string> = { scene: "场景", action: "动作", object: "物体" };

/* ── 关键帧 mock（用 canvas 生成色块缩略图） ── */
function generateKeyframe(seed: number, w: number, h: number): string {
  if (typeof document === "undefined") return "";
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  let s = seed;
  const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${rng() * 360}, 40%, 20%)`);
  g.addColorStop(1, `hsl(${rng() * 360}, 35%, 15%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const x = rng() * w, y = rng() * h, r = 30 + rng() * 80;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsla(${rng() * 360}, 50%, 45%, 0.4)`);
    rg.addColorStop(1, `hsla(0, 0%, 0%, 0)`);
    ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return c.toDataURL("image/jpeg", 0.8);
}

const KEYFRAME_TIMES = [0, 3, 8, 12, 18, 22];

/* ── 视频理解 mock 回复 ── */
function findVideoReply(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("总结") || lower.includes("内容") || lower.includes("摘要")) {
    return `## 视频内容摘要

这是一段 **产品演示视频**（约 24 秒），包含以下关键内容：

1. **开场**（0-3s）：演讲者在办公环境中出镜，自然光照明
2. **产品展示**（3-15s）：通过特写镜头展示核心功能，配合手势引导观众注意力
3. **总结收尾**（18-24s）：回到演讲者中景，品牌 Logo 淡出

### 视频元数据
| 属性 | 值 |
|------|------|
| 时长 | 24 秒 |
| 场景数 | 4 个 |
| 检测到的人物 | 1 人 |
| 文字叠加 | 1 处（"核心功能"） |

**适用场景：** 产品发布、社交媒体推广、内部培训
**建议优化：** 前 3 秒可增加 hook 文案提升完播率`;
  }
  if (lower.includes("平台") || lower.includes("投放") || lower.includes("适合")) {
    return `## 平台适配分析

| 平台 | 适配度 | 原因 |
|------|--------|------|
| 视频号 | ⭐⭐⭐⭐⭐ | 专业调性匹配，适合 B 端受众 |
| B 站 | ⭐⭐⭐⭐ | 内容深度足够，可加字幕增强体验 |
| 抖音 | ⭐⭐⭐ | 节奏偏慢，需加快前 3 秒节奏 |
| 小红书 | ⭐⭐ | 缺少生活化元素，不太匹配调性 |
| YouTube | ⭐⭐⭐⭐ | 适合作为产品介绍短片 |

### 优化建议
- **抖音版本：** 重新剪辑前 3 秒，加入悬念式开头
- **B 站版本：** 增加详细字幕和章节标记
- **视频号：** 可直接投放，建议加上公众号引导`;
  }
  if (lower.includes("字幕") || lower.includes("subtitle") || lower.includes("文字")) {
    return `## 自动字幕提取

\`\`\`
[00:00 - 00:03] 大家好，欢迎来到今天的产品发布会
[00:03 - 00:05] 我是产品负责人，今天给大家介绍
[00:05 - 00:08] 我们全新升级的核心功能
[00:08 - 00:12] 首先来看这个界面（画面切换到产品特写）
[00:12 - 00:15] 这里是我们的核心功能模块
[00:15 - 00:18] 通过简单的操作就能完成复杂的任务
[00:18 - 00:22] 感谢大家的关注，更多详情请访问官网
[00:22 - 00:24] （品牌 Logo 展示）
\`\`\`

> 以上字幕由 AI 语音识别自动生成（模拟数据）。实际产品中会使用 Whisper 等 ASR 模型。`;
  }
  if (lower.includes("关键帧") || lower.includes("截图") || lower.includes("画面")) {
    return `## 关键帧分析

AI 从视频中提取了 **6 个关键帧**，对应主要场景切换点：

| 时间 | 场景描述 | 视觉特征 |
|------|----------|----------|
| 0s | 开场 | 室内办公，自然光，暖色调 |
| 3s | 人物出镜 | 演讲者正面，中景构图 |
| 8s | 产品特写 | 屏幕界面，冷色调，高对比 |
| 12s | 文字叠加 | "核心功能"标题，居中排版 |
| 18s | 回到演讲者 | 中景，手势引导 |
| 22s | 品牌收尾 | Logo 居中，渐变背景 |

**构图分析：** 视频整体采用「人物-产品-人物」的三段式结构，节奏清晰。`;
  }
  if (lower.includes("情感") || lower.includes("情绪") || lower.includes("sentiment")) {
    return `## 视频情感分析

### 整体情感基调
**积极正面** — 置信度 87%

### 逐段情感变化

\`\`\`
积极 ████████████████████░░░░ 85%  (0-3s 开场)
中性 ██████████████░░░░░░░░░░ 60%  (3-8s 产品展示)
积极 ██████████████████████░░ 92%  (8-15s 功能亮点)
积极 ████████████████████░░░░ 82%  (15-22s 总结)
中性 ████████████░░░░░░░░░░░░ 50%  (22-24s Logo)
\`\`\`

### 语音情感特征
- **语速：** 中等偏快（约 180 字/分钟）
- **语调：** 上扬为主，在功能亮点处明显升高
- **停顿：** 场景切换处有自然停顿（~0.5s）

> 情感分析基于语音韵律 + 面部表情 + 文本语义的多模态融合。`;
  }
  // 兜底
  const fallbacks = [
    `## 关于「${text}」\n\n这是一个很好的分析方向。在实际的视频理解产品中，AI 会：\n\n1. **视觉分析** — 场景检测、物体识别、OCR 文字提取\n2. **语音分析** — ASR 转写、说话人识别、情感分析\n3. **语义理解** — 内容摘要、主题分类、关键信息提取\n4. **多模态融合** — 结合视觉+语音+文本给出综合分析\n\n> 试试问我：「总结视频内容」「提取字幕」「分析关键帧」「情感分析」「适合投放哪个平台」`,
    `## 视频分析：${text}\n\n当前视频是一段 24 秒的产品演示，包含 4 个场景切换、1 个人物、1 处文字叠加。\n\n你可以尝试更具体的问题，比如：\n- 「这个视频的情感基调是什么？」\n- 「帮我生成字幕」\n- 「分析关键帧画面」\n- 「适合投放在哪个平台？」`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

/* ── 快捷功能按钮 ── */
const QUICK_ACTIONS = [
  { label: "生成摘要", icon: FileText, query: "总结这个视频的内容" },
  { label: "提取字幕", icon: Captions, query: "帮我提取视频字幕" },
  { label: "关键帧分析", icon: ImageIcon, query: "分析视频的关键帧画面" },
  { label: "情感分析", icon: Sparkles, query: "分析视频的情感基调" },
];

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

export default function VideoStreamPage() {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [keyframes, setKeyframes] = useState<{ time: number; src: string }[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const totalDuration = 24;

  // 生成关键帧缩略图（客户端）
  useEffect(() => {
    setKeyframes(KEYFRAME_TIMES.map((t) => ({ time: t, src: generateKeyframe(t * 9973 + 42, 160, 90) })));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [chatMessages]);

  // 组件卸载清理
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setPlaying(false);
    } else {
      const startWall = performance.now();
      const startTime = currentTime;
      setPlaying(true);
      timerRef.current = setInterval(() => {
        const elapsed = (performance.now() - startWall) / 1000;
        const t = startTime + elapsed;
        if (t >= totalDuration) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPlaying(false);
          setCurrentTime(0);
        } else {
          setCurrentTime(t);
        }
      }, 100);
    }
  }, [playing, currentTime, totalDuration]);

  const seekTo = useCallback((time: number) => { setCurrentTime(time); }, []);

  const sendChat = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: text.trim() },
      { role: "assistant", content: "", streaming: true },
    ]);
    setChatInput("");
    setIsStreaming(true);

    const reply = findVideoReply(text);
    cancelRef.current = mockSSEStream(
      reply,
      (chunk) => {
        setChatMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      () => {
        setChatMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, streaming: false };
          }
          return updated;
        });
        setIsStreaming(false);
        cancelRef.current = null;
      },
    );
  }, [isStreaming]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setChatMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.role === "assistant" && last.streaming) {
        updated[updated.length - 1] = { ...last, streaming: false };
      }
      return updated;
    });
    setIsStreaming(false);
  }, []);

  const activeEvents = MOCK_TIMELINE.filter((e) => e.time <= currentTime);
  const filteredTimeline = typeFilter
    ? MOCK_TIMELINE.filter((e) => e.type === typeFilter)
    : MOCK_TIMELINE;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
            <Film className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">视频理解 / 生成</h1>
            <p className="text-sm text-muted-foreground">多模态视频分析 · 时间线标注 · 关键帧提取 · 对话式理解</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左侧：视频播放器 + 关键帧 + 时间线 */}
        <div className="flex flex-1 flex-col border-r border-border">
          {/* 模拟播放器 */}
          <div className="relative flex aspect-video max-h-[360px] items-center justify-center bg-black/40">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Film className="h-12 w-12 text-violet-400/30" />
              <p className="text-sm">模拟视频播放器</p>
              <p className="text-xs text-muted-foreground/60">
                {Math.floor(currentTime).toString().padStart(2, "0")}s / {totalDuration}s
              </p>
            </div>
            {activeEvents.length > 0 && (
              <div className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                {activeEvents[activeEvents.length - 1].label}: {activeEvents[activeEvents.length - 1].detail}
              </div>
            )}
            {playing && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-500/80 px-2.5 py-1 text-[10px] font-medium text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                播放中
              </div>
            )}
          </div>

          {/* 播放控制 */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <Button variant="outline" size="sm" onClick={togglePlay} className="gap-1.5">
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? "暂停" : "播放"}
            </Button>
            <div className="relative flex-1">
              <input type="range" min={0} max={totalDuration} step={0.5} value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))} className="w-full accent-violet-500" />
              {/* 关键帧标记点 */}
              <div className="absolute top-0 left-0 right-0 h-full pointer-events-none">
                {KEYFRAME_TIMES.map((t) => (
                  <div key={t} className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-violet-400/60"
                    style={{ left: `${(t / totalDuration) * 100}%` }} />
                ))}
              </div>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
              {Math.floor(currentTime).toString().padStart(2, "0")}s
            </span>
          </div>

          {/* 关键帧缩略图 */}
          {keyframes.length > 0 && (
            <div className="border-b border-border px-4 py-3">
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">关键帧</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {keyframes.map((kf) => (
                  <button key={kf.time} onClick={() => seekTo(kf.time)}
                    className={cn("shrink-0 rounded-lg border overflow-hidden transition-all",
                      Math.abs(currentTime - kf.time) < 1.5 ? "border-violet-500/50 ring-1 ring-violet-500/30" : "border-border hover:border-violet-500/30")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={kf.src} alt={`${kf.time}s`} className="h-[50px] w-[90px] object-cover" />
                    <div className="bg-card/80 px-1.5 py-0.5 text-center text-[10px] text-muted-foreground">{kf.time}s</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 时间线事件 */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">AI 时间线标注</p>
                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-muted-foreground/60" />
                  {[null, "scene", "action", "object"].map((f) => (
                    <button key={f ?? "all"} onClick={() => setTypeFilter(f)}
                      className={cn("rounded-md px-2 py-0.5 text-[10px] transition-colors",
                        typeFilter === f ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground/60 hover:text-muted-foreground")}>
                      {f ? TYPE_LABELS[f] : "全部"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {filteredTimeline.map((event) => {
                  const isActive = currentTime >= event.time;
                  return (
                    <button key={`${event.time}-${event.type}`} onClick={() => seekTo(event.time)}
                      className={cn("flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-all",
                        isActive ? "border-violet-500/20 bg-violet-500/5" : "border-border bg-card opacity-50")}>
                      <span className="w-7 text-xs tabular-nums text-muted-foreground">{event.time}s</span>
                      <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-medium", TYPE_COLORS[event.type])}>
                        {TYPE_LABELS[event.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{event.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* 右侧：对话式视频理解 */}
        <div className="flex w-[380px] shrink-0 flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquare className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-medium text-foreground">视频对话</span>
            {chatMessages.length > 0 && (
              <span className="text-[11px] text-muted-foreground/60">{chatMessages.filter((m) => !m.streaming).length} 条</span>
            )}
          </div>

          {/* 快捷功能按钮 */}
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2.5">
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} onClick={() => sendChat(a.query)} disabled={isStreaming}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-violet-500/30 hover:text-foreground disabled:opacity-50">
                <a.icon className="h-3 w-3" />
                {a.label}
              </button>
            ))}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 p-4">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Sparkles className="h-6 w-6 text-violet-400/30" />
                  <p className="text-xs text-muted-foreground">向 AI 提问关于视频的任何问题</p>
                  <p className="text-[11px] text-muted-foreground/50">或使用上方快捷按钮</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
                  <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "rounded-tr-md bg-gradient-to-r from-violet-500 to-purple-600 text-white"
                      : "rounded-tl-md bg-card text-foreground ring-1 ring-border")}>
                    {msg.role === "assistant" ? (
                      <>
                        <MarkdownContent content={msg.content} streaming={msg.streaming} />
                        {msg.streaming && !msg.content && (
                          <span className="inline-flex items-center gap-1">
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
                          </span>
                        )}
                      </>
                    ) : msg.content}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} className="h-2" />
            </div>
          </ScrollArea>

          <div className="shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(chatInput); }}
                placeholder="问关于视频的问题…" disabled={isStreaming}
                className="h-[42px] flex-1 rounded-xl border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50" />
              {isStreaming ? (
                <Button onClick={handleStop} size="icon" variant="outline"
                  className="h-[42px] w-[42px] shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => sendChat(chatInput)} size="icon" disabled={!chatInput.trim()}
                  className="h-[42px] w-[42px] shrink-0 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
