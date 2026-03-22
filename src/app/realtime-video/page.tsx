"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Radio, Play, Square, Wifi, WifiOff, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/* ── Canvas 粒子动画（作为视频源） ── */
function startCanvasAnimation(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width, h = canvas.height;
  let cancelled = false;
  let frame = 0;

  interface Dot { x: number; y: number; vx: number; vy: number; r: number; color: string; phase: number }
  const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFEAA7", "#DDA0DD", "#98D8C8", "#BB8FCE", "#85C1E9"];
  const dots: Dot[] = Array.from({ length: 50 }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
    r: 3 + Math.random() * 5,
    color: colors[Math.floor(Math.random() * colors.length)],
    phase: Math.random() * Math.PI * 2,
  }));

  const animate = () => {
    if (cancelled) return;
    frame++;
    ctx.fillStyle = "rgba(10, 10, 30, 0.2)";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(100,180,255,${0.2 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.stroke();
        }
      }
    }
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
      const pulse = 1 + 0.3 * Math.sin(frame * 0.03 + d.phase);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * pulse, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = "11px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "left";
    ctx.fillText("Local Source (Canvas)", 10, 18);
    requestAnimationFrame(animate);
  };
  ctx.fillStyle = "#0a0a1e";
  ctx.fillRect(0, 0, w, h);
  requestAnimationFrame(animate);
  return () => { cancelled = true; };
}


/* ── WebRTC 统计 ── */
interface RTCStatsData {
  connectionState: string;
  candidateCount: number;
  bitrate: number;
  fps: number;
  rtt: number;
  logs: string[];
}

const INITIAL_STATS: RTCStatsData = { connectionState: "new", candidateCount: 0, bitrate: 0, fps: 0, rtt: 0, logs: [] };

/* ── 信令流程步骤 ── */
const SIGNALING_STEPS = [
  { step: "createOffer()", desc: "发送端创建 SDP Offer" },
  { step: "setLocalDescription", desc: "发送端设置本地描述" },
  { step: "交换 SDP", desc: "通过信令服务器传递 Offer" },
  { step: "createAnswer()", desc: "接收端创建 SDP Answer" },
  { step: "ICE Candidate 交换", desc: "双端交换网络候选地址" },
  { step: "连接建立 ✅", desc: "P2P 通道就绪，开始传输" },
];

/* ── 技术对比数据 ── */
const TECH_COMPARE = [
  { label: "延迟", webrtc: "< 500ms", mse: "2~10s" },
  { label: "协议", webrtc: "UDP (SRTP)", mse: "TCP (HTTP)" },
  { label: "方向", webrtc: "双向", mse: "单向" },
  { label: "复杂度", webrtc: "高", mse: "低" },
];

export default function RealtimeVideoPage() {
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<RTCStatsData>(INITIAL_STATS);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // 组件卸载清理
  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const startConnection = useCallback(async () => {
    const canvas = localCanvasRef.current;
    const video = remoteVideoRef.current;
    if (!canvas || !video) return;

    setRunning(true);
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString("zh-CN")}] ${msg}`);
      if (logs.length > 30) logs.shift();
    };

    // 启动 Canvas 动画
    const stopAnim = startCanvasAnimation(canvas);

    // 获取 Canvas 媒体流
    const stream = canvas.captureStream(30);
    log("✅ Canvas captureStream (30fps)");

    // 创建双端 PeerConnection
    const config: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
    const senderPC = new RTCPeerConnection(config);
    const receiverPC = new RTCPeerConnection(config);
    let candidateCount = 0;
    log("✅ 创建 senderPC + receiverPC");

    // ICE candidate 交换
    senderPC.onicecandidate = (e) => {
      if (e.candidate) { candidateCount++; receiverPC.addIceCandidate(e.candidate); log(`🔄 sender → receiver ICE #${candidateCount}`); }
    };
    receiverPC.onicecandidate = (e) => {
      if (e.candidate) { candidateCount++; senderPC.addIceCandidate(e.candidate); log(`🔄 receiver → sender ICE #${candidateCount}`); }
    };

    // 接收端拿到远端流
    receiverPC.ontrack = (e) => {
      log("✅ receiverPC 收到远端 track");
      video.srcObject = e.streams[0];
      video.play().catch(() => { });
    };

    senderPC.onconnectionstatechange = () => log(`📡 sender: ${senderPC.connectionState}`);
    receiverPC.onconnectionstatechange = () => log(`📡 receiver: ${receiverPC.connectionState}`);

    // 添加轨道
    for (const track of stream.getTracks()) senderPC.addTrack(track, stream);
    log("✅ 添加视频轨道");

    // SDP 交换
    const offer = await senderPC.createOffer();
    log("📝 创建 Offer SDP");
    await senderPC.setLocalDescription(offer);
    await receiverPC.setRemoteDescription(offer);
    log("📝 交换 Offer");

    const answer = await receiverPC.createAnswer();
    log("📝 创建 Answer SDP");
    await receiverPC.setLocalDescription(answer);
    await senderPC.setRemoteDescription(answer);
    log("📝 交换 Answer → 连接建立中…");

    // 统计采集
    let prevBytes = 0, prevTs = 0;
    const statsInterval = setInterval(async () => {
      try {
        const s = await senderPC.getStats();
        let bitrate = 0, fps = 0, rtt = 0;
        s.forEach((r) => {
          if (r.type === "outbound-rtp" && r.kind === "video") {
            if (prevTs > 0) { const dt = (r.timestamp - prevTs) / 1000; if (dt > 0) bitrate = Math.round(((r.bytesSent - prevBytes) * 8) / dt / 1000); }
            prevBytes = r.bytesSent; prevTs = r.timestamp;
            fps = r.framesPerSecond || 0;
          }
          if (r.type === "candidate-pair" && r.state === "succeeded") rtt = r.currentRoundTripTime ? Math.round(r.currentRoundTripTime * 1000) : 0;
        });
        setStats({ connectionState: senderPC.connectionState, candidateCount, bitrate, fps, rtt, logs: [...logs] });
      } catch { /* closed */ }
    }, 1000);

    setStats({ connectionState: "connecting", candidateCount: 0, bitrate: 0, fps: 0, rtt: 0, logs: [...logs] });

    cleanupRef.current = () => {
      stopAnim();
      clearInterval(statsInterval);
      senderPC.close();
      receiverPC.close();
      stream.getTracks().forEach((t) => t.stop());
      setRunning(false);
      setStats(INITIAL_STATS);
    };
  }, []);

  const stopConnection = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const isConnected = stats.connectionState === "connected";

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-md shadow-rose-500/20">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">WebRTC 实时通信</h1>
            <p className="text-sm text-muted-foreground">P2P 视频传输 · SDP 信令交换 · ICE 穿透 · 实时统计</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左侧：双端视频 */}
        <div className="flex flex-1 flex-col border-r border-border">
          {/* 双端视频区 */}
          <div className="flex flex-1 items-center gap-4 p-6">
            {/* 发送端 */}
            <div className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">发送端 (Local)</span>
              <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black/40" style={{ aspectRatio: "16/10" }}>
                <canvas ref={localCanvasRef} width={640} height={400} className="h-full w-full object-contain" />
                {!running && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                    <span className="text-3xl">📹</span>
                    <p className="mt-2 text-xs text-muted-foreground">Canvas 视频源</p>
                  </div>
                )}
              </div>
            </div>

            {/* 连接指示 */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              {running ? (
                <>
                  <Activity className={cn("h-5 w-5", isConnected ? "text-emerald-400 animate-pulse" : "text-amber-400 animate-spin")} />
                  <span className="text-[11px] font-medium text-emerald-400">WebRTC</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-5 w-5 text-muted-foreground/30" />
                  <span className="text-[11px] text-muted-foreground/40">未连接</span>
                </>
              )}
            </div>

            {/* 接收端 */}
            <div className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">接收端 (Remote)</span>
              <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black/40" style={{ aspectRatio: "16/10" }}>
                <video ref={remoteVideoRef} muted playsInline autoPlay className="h-full w-full object-contain" />
                {!running && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                    <span className="text-3xl">📺</span>
                    <p className="mt-2 text-xs text-muted-foreground">RTCPeerConnection</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 控制栏 */}
          <div className="flex items-center gap-4 border-t border-border px-6 py-3">
            <Button onClick={running ? stopConnection : startConnection}
              className={cn("gap-2", running ? "bg-destructive hover:bg-destructive/90" : "bg-gradient-to-r from-rose-500 to-orange-500")}>
              {running ? <><Square className="h-4 w-4" /> 断开连接</> : <><Play className="h-4 w-4" /> 建立连接</>}
            </Button>
            {running && (
              <div className="flex items-center gap-4 text-xs">
                <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
                  isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
                  <Wifi className="h-3 w-3" /> {stats.connectionState}
                </span>
                <span className="text-muted-foreground">{stats.bitrate} kbps</span>
                <span className="text-muted-foreground">{stats.fps} fps</span>
                <span className="text-muted-foreground">RTT {stats.rtt}ms</span>
                <span className="text-muted-foreground">ICE ×{stats.candidateCount}</span>
              </div>
            )}
          </div>

          {/* 信令日志 */}
          {stats.logs.length > 0 && (
            <div className="border-t border-border">
              <ScrollArea className="h-[140px]">
                <div className="p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {stats.logs.map((log, i) => (
                    <div key={i} className={cn(log.includes("✅") ? "text-emerald-400/80" : log.includes("🔄") ? "text-indigo-400/70" : "text-muted-foreground/70")}>
                      {log}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* 右侧：技术说明 */}
        <div className="w-[300px] shrink-0">
          <ScrollArea className="h-full">
            <div className="space-y-5 p-5">
              <div>
                <span className="inline-block rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1 text-[11px] font-medium text-white">
                  P2P 实时通信
                </span>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  同页面内创建两个 RTCPeerConnection，Canvas 粒子动画通过 captureStream 采集后经 WebRTC 传输到远端播放。无需信令服务器。
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">技术栈</p>
                <div className="flex flex-wrap gap-1.5">
                  {["RTCPeerConnection", "SDP 交换", "ICE Candidate", "captureStream", "SRTP (UDP)", "getStats()"].map((t) => (
                    <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">信令流程</p>
                <div className="flex flex-col gap-1.5">
                  {SIGNALING_STEPS.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg border-l-2 border-rose-500/30 bg-secondary/50 px-3 py-2">
                      <span className="mt-0.5 text-[10px] font-bold text-rose-400">{i + 1}</span>
                      <div>
                        <p className="text-[12px] font-medium text-foreground">{s.step}</p>
                        <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">WebRTC vs MSE</p>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full text-[11px]">
                    <thead><tr className="bg-secondary/50">
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">指标</th>
                      <th className="px-3 py-1.5 text-left font-medium text-rose-400">WebRTC</th>
                      <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">MSE</th>
                    </tr></thead>
                    <tbody>
                      {TECH_COMPARE.map((r) => (
                        <tr key={r.label} className="border-t border-border">
                          <td className="px-3 py-1.5 text-muted-foreground">{r.label}</td>
                          <td className="px-3 py-1.5 text-foreground">{r.webrtc}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.mse}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">应用场景</p>
                <ul className="space-y-1 text-[12px] leading-relaxed text-muted-foreground">
                  <li>• AI 数字人实时对话</li>
                  <li>• 视频通话 / 会议</li>
                  <li>• 互动直播 / 连麦</li>
                  <li>• 屏幕共享</li>
                  <li>• 云游戏串流</li>
                </ul>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
