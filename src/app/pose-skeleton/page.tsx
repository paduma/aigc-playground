"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PersonStanding, Play, Pause, RotateCcw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── COCO-17 关键点 ── */
const KEYPOINT_NAMES = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip",
  "left_knee", "right_knee", "left_ankle", "right_ankle",
];

const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

interface Keypoint { x: number; y: number; confidence: number }
interface PoseFrame { keypoints: Keypoint[]; action: string }

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeInOut(t: number) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function makePose(cx: number, cy: number, s: number, offsets: number[][]): Keypoint[] {
  return offsets.map(([dx, dy]) => ({ x: cx + dx * s, y: cy + dy * s, confidence: 0.85 + Math.random() * 0.15 }));
}

function interpolatePose(a: Keypoint[], b: Keypoint[], t: number): Keypoint[] {
  return a.map((kp, i) => ({ x: lerp(kp.x, b[i].x, t), y: lerp(kp.y, b[i].y, t), confidence: lerp(kp.confidence, b[i].confidence, t) }));
}


/* ── 太极拳关键帧 ── */
function getTaichiKeyframes(cx: number, cy: number, s: number) {
  return [
    { action: "起势 · 预备", duration: 60, pose: makePose(cx, cy, s, [[0, -80], [-5, -85], [5, -85], [-12, -82], [12, -82], [-25, -50], [25, -50], [-25, -20], [25, -20], [-20, 5], [20, 5], [-15, 20], [15, 20], [-15, 55], [15, 55], [-15, 90], [15, 90]]) },
    { action: "起势 · 双臂上提", duration: 50, pose: makePose(cx, cy, s, [[0, -80], [-5, -85], [5, -85], [-12, -82], [12, -82], [-25, -50], [25, -50], [-30, -45], [30, -45], [-35, -55], [35, -55], [-15, 20], [15, 20], [-15, 55], [15, 55], [-15, 90], [15, 90]]) },
    { action: "云手 · 左", duration: 70, pose: makePose(cx, cy, s, [[-5, -80], [-10, -85], [0, -85], [-17, -82], [7, -82], [-28, -50], [22, -50], [-45, -35], [20, -15], [-50, -50], [25, 5], [-18, 20], [12, 20], [-18, 55], [12, 55], [-18, 90], [12, 90]]) },
    { action: "云手 · 右", duration: 70, pose: makePose(cx, cy, s, [[5, -80], [0, -85], [10, -85], [-7, -82], [17, -82], [-22, -50], [28, -50], [-20, -15], [45, -35], [-25, 5], [50, -50], [-12, 20], [18, 20], [-12, 55], [18, 55], [-12, 90], [18, 90]]) },
    { action: "单鞭 · 展臂", duration: 60, pose: makePose(cx, cy, s, [[0, -78], [-5, -83], [5, -83], [-12, -80], [12, -80], [-28, -48], [28, -48], [-50, -40], [50, -40], [-65, -35], [60, -30], [-15, 22], [15, 22], [-20, 58], [20, 58], [-22, 92], [22, 92]]) },
    { action: "收势 · 归元", duration: 60, pose: makePose(cx, cy, s, [[0, -80], [-5, -85], [5, -85], [-12, -82], [12, -82], [-25, -50], [25, -50], [-22, -25], [22, -25], [-15, 0], [15, 0], [-15, 20], [15, 20], [-15, 55], [15, 55], [-15, 90], [15, 90]]) },
  ];
}

function generateFrames(w: number, h: number): PoseFrame[] {
  const cx = w / 2, cy = h / 2 + 20, s = Math.min(w, h) / 250;
  const kfs = getTaichiKeyframes(cx, cy, s);
  const frames: PoseFrame[] = [];
  for (let k = 0; k < kfs.length; k++) {
    const cur = kfs[k], next = kfs[(k + 1) % kfs.length];
    for (let f = 0; f < cur.duration; f++) {
      const t = easeInOut(f / cur.duration);
      const pose = interpolatePose(cur.pose, next.pose, t).map((kp) => ({
        ...kp, x: kp.x + (Math.random() - 0.5) * 1.5, y: kp.y + (Math.random() - 0.5) * 1.5,
      }));
      frames.push({ keypoints: pose, action: cur.action });
    }
  }
  return frames;
}

/* ── 渲染一帧 ── */
function renderFrame(ctx: CanvasRenderingContext2D, w: number, h: number, frame: PoseFrame, idx: number, total: number) {
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0f1923"); bg.addColorStop(1, "#1a2a3a");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  // 地面线
  ctx.strokeStyle = "rgba(100,200,255,0.08)"; ctx.lineWidth = 1;
  for (let y = h * 0.7; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

  const kps = frame.keypoints;

  // 手腕光晕
  for (const i of [9, 10]) {
    const p = kps[i];
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 25);
    g.addColorStop(0, "rgba(64,224,208,0.3)"); g.addColorStop(1, "transparent");
    ctx.beginPath(); ctx.arc(p.x, p.y, 25, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  }

  // 骨骼连线
  for (const [a, b] of SKELETON_CONNECTIONS) {
    const pA = kps[a], pB = kps[b];
    if (pA.confidence < 0.3 || pB.confidence < 0.3) continue;
    const g = ctx.createLinearGradient(pA.x, pA.y, pB.x, pB.y);
    g.addColorStop(0, "rgba(0,200,255,0.8)"); g.addColorStop(1, "rgba(0,255,200,0.8)");
    ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y);
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.stroke();
    // 外发光
    ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y);
    ctx.strokeStyle = "rgba(0,200,255,0.15)"; ctx.lineWidth = 8; ctx.stroke();
  }

  // 关键点
  for (let i = 0; i < kps.length; i++) {
    const p = kps[i]; if (p.confidence < 0.3) continue;
    const isHead = i <= 4, isHand = i === 9 || i === 10;
    const r = isHead ? 5 : isHand ? 6 : 4;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
    ctx.fillStyle = isHand ? "rgba(255,200,0,0.2)" : "rgba(0,200,255,0.15)"; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isHand ? "#FFD700" : isHead ? "#FF6B6B" : "#00E5FF"; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fill();
  }

  // 动作名
  ctx.font = "bold 18px -apple-system, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.textAlign = "center"; ctx.fillText(frame.action, w / 2, 30);

  // 数据面板
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath(); ctx.roundRect(10, h - 70, 220, 60, 8); ctx.fill();
  ctx.font = "11px monospace"; ctx.fillStyle = "#88ccff"; ctx.textAlign = "left";
  ctx.fillText("Pose Keypoints Stream", 18, h - 54);
  ctx.fillStyle = "#aaa"; ctx.font = "10px monospace";
  ctx.fillText(`keypoints: ${kps.length} (COCO-17)`, 18, h - 38);
  ctx.fillText(`frame: ${idx}/${total}  confidence: ${(kps.reduce((s, k) => s + k.confidence, 0) / kps.length).toFixed(3)}`, 18, h - 22);
}


/* ── 主页面 ── */
export default function PoseSkeletonPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [action, setAction] = useState("");
  const [totalFrames, setTotalFrames] = useState(0);
  const framesRef = useRef<PoseFrame[]>([]);
  const animRef = useRef<number>(0);
  const playingRef = useRef(false);

  // 生成帧数据
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frames = generateFrames(canvas.width, canvas.height);
    framesRef.current = frames;
    setTotalFrames(frames.length);
    // 渲染第一帧
    const ctx = canvas.getContext("2d");
    if (ctx && frames.length > 0) renderFrame(ctx, canvas.width, canvas.height, frames[0], 0, frames.length);
  }, []);

  // 组件卸载
  useEffect(() => {
    return () => { cancelAnimationFrame(animRef.current); };
  }, []);

  const startPlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || playingRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const frames = framesRef.current;
    const w = canvas.width, h = canvas.height;
    playingRef.current = true;
    setPlaying(true);

    let idx = frameIdx;
    let lastTime = 0;
    const interval = 1000 / 30;

    const tick = (ts: number) => {
      if (!playingRef.current) return;
      if (idx >= frames.length) {
        idx = 0; // 循环
      }
      if (ts - lastTime >= interval) {
        lastTime = ts;
        renderFrame(ctx, w, h, frames[idx], idx, frames.length);
        setFrameIdx(idx);
        setAction(frames[idx].action);
        idx++;
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, [frameIdx]);

  const pausePlay = useCallback(() => {
    playingRef.current = false;
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
  }, []);

  const resetPlay = useCallback(() => {
    playingRef.current = false;
    cancelAnimationFrame(animRef.current);
    setPlaying(false);
    setFrameIdx(0);
    setAction("");
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const frames = framesRef.current;
    if (ctx && frames.length > 0) renderFrame(ctx, canvas.width, canvas.height, frames[0], 0, frames.length);
  }, []);

  const progress = totalFrames > 0 ? Math.round((frameIdx / totalFrames) * 100) : 0;

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 shadow-md shadow-cyan-500/20">
            <PersonStanding className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">骨骼动画</h1>
            <p className="text-sm text-muted-foreground">COCO-17 关键点 · Pose Estimation · 骨骼连线渲染 · 太极拳动作序列</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左侧：Canvas */}
        <div className="flex flex-1 flex-col border-r border-border">
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="relative overflow-hidden rounded-xl border border-border shadow-2xl shadow-cyan-500/5" style={{ aspectRatio: "16/10", maxHeight: "100%", maxWidth: "100%" }}>
              <canvas ref={canvasRef} width={640} height={400} className="h-full w-full" />
            </div>
          </div>

          {/* 控制栏 */}
          <div className="flex items-center gap-4 border-t border-border px-6 py-3">
            <Button onClick={playing ? pausePlay : startPlay}
              className={cn("gap-2", playing ? "bg-amber-600 hover:bg-amber-700" : "bg-gradient-to-r from-cyan-500 to-teal-500")}>
              {playing ? <><Pause className="h-4 w-4" /> 暂停</> : <><Play className="h-4 w-4" /> 播放</>}
            </Button>
            <Button variant="outline" size="sm" onClick={resetPlay} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> 重置
            </Button>

            {/* 进度条 */}
            <div className="flex flex-1 items-center gap-3">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-100"
                  style={{ width: `${progress}%` }} />
              </div>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{progress}%</span>
            </div>

            {action && (
              <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                <Activity className="h-3 w-3" /> {action}
              </span>
            )}
            <span className="text-xs tabular-nums text-muted-foreground">{frameIdx}/{totalFrames}</span>
          </div>
        </div>

        {/* 右侧：技术说明 */}
        <div className="w-[300px] shrink-0">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-5">
              <div>
                <span className="inline-block rounded-full bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-1 text-[11px] font-medium text-white">
                  关键点驱动动画
                </span>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  后端推送 COCO-17 人体关键点坐标序列，前端 Canvas 绘制骨骼连线和关键点，实现火柴人运动动画。动作序列为太极拳起势→云手→单鞭→收势。
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">技术栈</p>
                <div className="flex flex-wrap gap-1.5">
                  {["Pose Estimation", "COCO-17", "关键点插值", "骨骼连线", "Canvas 2D", "ease-in-out"].map((t) => (
                    <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">COCO-17 关键点</p>
                <div className="grid grid-cols-2 gap-1">
                  {KEYPOINT_NAMES.map((name, i) => (
                    <div key={name} className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px]">
                      <span className={cn("h-2 w-2 rounded-full", i <= 4 ? "bg-red-400" : i <= 10 ? "bg-cyan-400" : "bg-teal-400")} />
                      <span className="text-muted-foreground">{i}. {name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">数据格式</p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-card p-3 text-[10px] leading-relaxed text-muted-foreground">
                  {`{
  "keypoints": [
    {"x": 320, "y": 80, "conf": 0.95},
    {"x": 315, "y": 75, "conf": 0.92},
    ...  // 17 个关键点
  ],
  "action": "云手 · 左"
}`}
                </pre>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">应用场景</p>
                <ul className="space-y-1 text-[12px] leading-relaxed text-muted-foreground">
                  <li>• 运动分析 / 体育训练</li>
                  <li>• 医疗康复评估</li>
                  <li>• 动作捕捉 → 3D 角色驱动</li>
                  <li>• 舞蹈 / 健身教学</li>
                  <li>• 安防行为识别</li>
                </ul>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">渲染特性</p>
                <ul className="space-y-1 text-[12px] leading-relaxed text-muted-foreground">
                  <li>• 渐变骨骼线 + 外发光</li>
                  <li>• 头/手/身体分色关键点</li>
                  <li>• 手腕运动轨迹光晕</li>
                  <li>• ease-in-out 帧间插值</li>
                  <li>• 微抖动模拟真实感</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
