"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Workflow, Settings, Play, Save, Send, Square,
  User, Trash2, Plus, X,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { mockSSEStream } from "@/lib/mock-sse";
import {
  type AgentConfig,
  createDemoAgents,
  getAvailableTools,
  getAgentReply,
} from "@/lib/agent-store";
import { MarkdownContent } from "@/components/chat/markdown-content";
import { CustomSelect } from "@/components/ui/custom-select";

/* ── 编排模式：节点类型定义 ── */
interface FlowNode {
  id: string;
  type: string;
  label: string;
  icon: string;
  x: number;
  y: number;
  desc: string;
}

interface FlowEdge {
  from: string;
  to: string;
}

const NODE_PALETTE = [
  { type: "start", label: "开始", icon: "▶️", desc: "流程入口" },
  { type: "llm", label: "LLM 调用", icon: "🤖", desc: "调用大语言模型" },
  { type: "knowledge", label: "知识检索", icon: "📚", desc: "RAG 向量检索" },
  { type: "tool", label: "工具调用", icon: "🔧", desc: "Function Calling" },
  { type: "condition", label: "条件分支", icon: "🔀", desc: "If / Else 逻辑" },
  { type: "code", label: "代码执行", icon: "💻", desc: "运行自定义代码" },
  { type: "http", label: "HTTP 请求", icon: "🌐", desc: "调用外部 API" },
  { type: "output", label: "输出", icon: "📤", desc: "返回最终结果" },
];

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "deepseek-v3", label: "DeepSeek V3" },
  { value: "qwen-max", label: "通义千问 Max" },
  { value: "glm-4", label: "GLM-4" },
];

/* ── 默认编排节点 ── */
function createDefaultFlow(): { nodes: FlowNode[]; edges: FlowEdge[] } {
  return {
    nodes: [
      { id: "n-start", type: "start", label: "开始", icon: "▶️", x: 60, y: 180, desc: "用户输入" },
      { id: "n-llm", type: "llm", label: "LLM 调用", icon: "🤖", x: 320, y: 180, desc: "GPT-4o" },
      { id: "n-output", type: "output", label: "输出", icon: "📤", x: 580, y: 180, desc: "返回结果" },
    ],
    edges: [
      { from: "n-start", to: "n-llm" },
      { from: "n-llm", to: "n-output" },
    ],
  };
}

let _nid = 0;
function genNodeId() { return `n-${Date.now()}-${++_nid}`; }

/* ── 测试对话消息 ── */
interface TestMsg { role: "user" | "assistant"; content: string; streaming?: boolean; }


/* ══════════════════════════════════════════
   简单模式
   ══════════════════════════════════════════ */
function SimpleMode({ agent, onChange }: { agent: AgentConfig; onChange: (a: AgentConfig) => void }) {
  const tools = agent.tools;

  const toggleTool = useCallback((id: string) => {
    onChange({
      ...agent,
      tools: tools.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t)),
      updatedAt: Date.now(),
    });
  }, [agent, tools, onChange]);

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* 基本信息 */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">基本信息</h3>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
            <span className="text-sm text-muted-foreground">名称</span>
            <input value={agent.name} onChange={(e) => onChange({ ...agent, name: e.target.value })}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            <span className="text-sm text-muted-foreground">图标</span>
            <input value={agent.icon} onChange={(e) => onChange({ ...agent, icon: e.target.value })}
              className="w-16 rounded-lg border border-border bg-input px-3 py-2 text-center text-lg focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
            <span className="text-sm text-muted-foreground">描述</span>
            <input value={agent.description} onChange={(e) => onChange({ ...agent, description: e.target.value })}
              className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
        </section>

        {/* 模型配置 */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">模型配置</h3>
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
            <span className="text-sm text-muted-foreground">模型</span>
            <CustomSelect value={agent.model} onChange={(v) => onChange({ ...agent, model: v })}
              options={MODELS} placeholder="选择模型" />
            <span className="text-sm text-muted-foreground">温度</span>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={1} step={0.1} value={agent.temperature}
                onChange={(e) => onChange({ ...agent, temperature: parseFloat(e.target.value) })}
                className="flex-1 accent-indigo-500" />
              <span className="w-8 text-right text-sm tabular-nums text-foreground">{agent.temperature}</span>
            </div>
            <span className="text-sm text-muted-foreground">最大 Token</span>
            <input type="number" value={agent.maxTokens} onChange={(e) => onChange({ ...agent, maxTokens: parseInt(e.target.value) || 2048 })}
              className="w-32 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
        </section>

        {/* System Prompt */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">系统提示词</h3>
          <textarea value={agent.systemPrompt} onChange={(e) => onChange({ ...agent, systemPrompt: e.target.value })}
            rows={6}
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30"
            placeholder="输入系统提示词，使用 {{input}} 表示用户输入，{{context}} 表示上下文…" />
          <p className="text-[11px] text-muted-foreground/60">
            变量：{"{{input}}"} 用户输入 · {"{{context}}"} 知识库上下文
          </p>
        </section>

        {/* 工具 */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">工具能力</h3>
          <div className="grid grid-cols-2 gap-2">
            {tools.map((t) => (
              <button key={t.id} onClick={() => toggleTool(t.id)}
                className={cn("flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-all",
                  t.enabled ? "border-indigo-500/30 bg-indigo-500/5 text-foreground" : "border-border bg-card text-muted-foreground hover:border-border/80")}>
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-sm",
                  t.enabled ? "bg-indigo-500/15" : "bg-secondary")}>
                  {t.type === "web_search" ? "🔍" : t.type === "code_exec" ? "💻" : t.type === "db_query" ? "🗄️" : t.type === "api_call" ? "🌐" : "📚"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.enabled ? "已启用" : "未启用"}</p>
                </div>
                <div className={cn("h-4 w-4 rounded-full border-2 transition-colors",
                  t.enabled ? "border-indigo-500 bg-indigo-500" : "border-muted-foreground/30")} />
              </button>
            ))}
          </div>
        </section>

        {/* 知识库 */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">知识库</h3>
          <div className="flex flex-wrap gap-2">
            {agent.knowledgeBase.map((kb) => (
              <span key={kb} className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-foreground">
                📄 {kb}
                <button onClick={() => onChange({ ...agent, knowledgeBase: agent.knowledgeBase.filter((k) => k !== kb) })}
                  className="ml-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
              </span>
            ))}
            <button className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/30 hover:text-foreground">
              <Plus className="h-3 w-3" /> 添加
            </button>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}


/* ══════════════════════════════════════════
   编排模式 — 画布 + 拖拽 + 连线
   ══════════════════════════════════════════ */

const NODE_W = 180;
const NODE_H = 72;

function WorkflowMode({
  nodes, edges, selectedId,
  onNodesChange, onEdgesChange, onSelect,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  selectedId: string | null;
  onNodesChange: (n: FlowNode[]) => void;
  onEdgesChange: (e: FlowEdge[]) => void;
  onSelect: (id: string | null) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const connectRef = useRef<{ fromId: string; x: number; y: number } | null>(null);
  const [connectLine, setConnectLine] = useState<{ x1: number; y1: number; x2: number; y2: number; ox: number; oy: number } | null>(null);

  /* 拖拽移动节点 */
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    onSelect(nodeId);
    dragRef.current = { nodeId, offsetX: e.clientX - node.x, offsetY: e.clientY - node.y };
  }, [nodes, onSelect]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const { nodeId, offsetX, offsetY } = dragRef.current;
        const x = Math.max(0, e.clientX - offsetX);
        const y = Math.max(0, e.clientY - offsetY);
        onNodesChange(nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)));
      }
      if (connectRef.current) {
        setConnectLine((prev) => prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null);
      }
    };
    const handleMouseUp = () => {
      dragRef.current = null;
      if (connectRef.current) {
        connectRef.current = null;
        setConnectLine(null);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [nodes, onNodesChange]);

  /* 从面板拖入新节点 */
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("node-type");
    const palette = NODE_PALETTE.find((p) => p.type === data);
    if (!palette || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - NODE_W / 2;
    const y = e.clientY - rect.top - NODE_H / 2;
    const newNode: FlowNode = {
      id: genNodeId(),
      type: palette.type,
      label: palette.label,
      icon: palette.icon,
      desc: palette.desc,
      x: Math.max(0, x),
      y: Math.max(0, y),
    };
    onNodesChange([...nodes, newNode]);
    onSelect(newNode.id);
  }, [nodes, onNodesChange, onSelect]);

  /* 连线：从输出端口拖到另一个节点 */
  const handlePortMouseDown = useCallback((e: React.MouseEvent, fromId: string) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === fromId);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    connectRef.current = { fromId, x: e.clientX, y: e.clientY };
    setConnectLine({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY, ox: rect.left, oy: rect.top });
  }, [nodes]);

  const handleNodeMouseUp = useCallback((e: React.MouseEvent, toId: string) => {
    if (connectRef.current && connectRef.current.fromId !== toId) {
      const exists = edges.some((ed) => ed.from === connectRef.current!.fromId && ed.to === toId);
      if (!exists) {
        onEdgesChange([...edges, { from: connectRef.current.fromId, to: toId }]);
      }
    }
    connectRef.current = null;
    setConnectLine(null);
  }, [edges, onEdgesChange]);

  const deleteNode = useCallback((id: string) => {
    onNodesChange(nodes.filter((n) => n.id !== id));
    onEdgesChange(edges.filter((e) => e.from !== id && e.to !== id));
    onSelect(null);
  }, [nodes, edges, onNodesChange, onEdgesChange, onSelect]);

  const deleteEdge = useCallback((from: string, to: string) => {
    onEdgesChange(edges.filter((e) => !(e.from === from && e.to === to)));
  }, [edges, onEdgesChange]);

  /* 计算 SVG 连线路径（贝塞尔曲线） */
  const edgePaths = useMemo(() => {
    return edges.map((edge) => {
      const fromNode = nodes.find((n) => n.id === edge.from);
      const toNode = nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) return null;
      const x1 = fromNode.x + NODE_W;
      const y1 = fromNode.y + NODE_H / 2;
      const x2 = toNode.x;
      const y2 = toNode.y + NODE_H / 2;
      const cx = (x1 + x2) / 2;
      return { edge, d: `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`, mx: cx, my: (y1 + y2) / 2 };
    }).filter(Boolean) as { edge: FlowEdge; d: string; mx: number; my: number }[];
  }, [nodes, edges]);

  return (
    <div className="flex min-h-0 flex-1">
      {/* 节点面板 */}
      <div className="w-[200px] shrink-0 border-r border-border bg-card/50">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">节点组件</p>
        </div>
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-1.5 p-2">
            {NODE_PALETTE.map((node) => (
              <div key={node.type} draggable
                onDragStart={(e) => { e.dataTransfer.setData("node-type", node.type); e.dataTransfer.effectAllowed = "copy"; }}
                className="flex cursor-grab items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-all hover:border-primary/30 hover:shadow-sm active:cursor-grabbing">
                <span className="text-base">{node.icon}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{node.label}</p>
                  <p className="text-[10px] text-muted-foreground">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 画布 */}
      <div ref={canvasRef} className="relative flex-1 overflow-auto bg-card/20"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
        onDrop={handleCanvasDrop}
        onClick={() => onSelect(null)}
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>

        {/* SVG 连线层 */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(129,140,248,0.6)" />
            </marker>
          </defs>
          {edgePaths.map(({ edge, d, mx, my }) => (
            <g key={`${edge.from}-${edge.to}`}>
              <path d={d} fill="none" stroke="rgba(129,140,248,0.35)" strokeWidth={2} markerEnd="url(#arrow)" />
              {/* 删除按钮 */}
              <g className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); deleteEdge(edge.from, edge.to); }}>
                <circle cx={mx} cy={my} r={8} fill="rgba(15,15,25,0.9)" stroke="rgba(129,140,248,0.3)" strokeWidth={1} className="opacity-0 transition-opacity hover:opacity-100" />
                <text x={mx} y={my + 1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="rgba(248,113,113,0.8)" className="opacity-0 transition-opacity hover:opacity-100">×</text>
              </g>
            </g>
          ))}
          {/* 拖拽连线预览 */}
          {connectLine && (() => {
            const x1 = connectLine.x1 - connectLine.ox;
            const y1 = connectLine.y1 - connectLine.oy;
            const x2 = connectLine.x2 - connectLine.ox;
            const y2 = connectLine.y2 - connectLine.oy;
            return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(129,140,248,0.5)" strokeWidth={2} strokeDasharray="6 3" />;
          })()}
        </svg>

        {/* 节点层 */}
        {nodes.map((node) => (
          <div key={node.id}
            className={cn("absolute flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-lg transition-shadow select-none",
              selectedId === node.id ? "border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-indigo-500/10" : "border-border hover:border-indigo-500/30")}
            style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
            onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            onClick={(e) => e.stopPropagation()}
            onMouseUp={(e) => handleNodeMouseUp(e, node.id)}>
            {/* 输入端口 */}
            {node.type !== "start" && (
              <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-indigo-500/40 bg-card" />
            )}
            <span className="text-lg">{node.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{node.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{node.desc}</p>
            </div>
            {/* 输出端口 */}
            {node.type !== "output" && (
              <div className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-indigo-500/40 bg-indigo-500/20 transition-colors hover:bg-indigo-500/40"
                onMouseDown={(e) => handlePortMouseDown(e, node.id)} />
            )}
          </div>
        ))}

        {/* 空画布提示 */}
        {nodes.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Workflow className="h-12 w-12 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">拖拽左侧节点到画布开始编排</p>
            </div>
          </div>
        )}
      </div>

      {/* 属性面板 */}
      <div className="w-[240px] shrink-0 border-l border-border bg-card/50">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">节点属性</p>
        </div>
        {selectedId ? (() => {
          const node = nodes.find((n) => n.id === selectedId);
          if (!node) return null;
          return (
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">{node.icon}</span>
                <input value={node.label}
                  onChange={(e) => onNodesChange(nodes.map((n) => (n.id === selectedId ? { ...n, label: e.target.value } : n)))}
                  className="flex-1 rounded-lg border border-border bg-input px-2 py-1.5 text-sm font-medium text-foreground focus:border-primary/50 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">描述</label>
                <input value={node.desc}
                  onChange={(e) => onNodesChange(nodes.map((n) => (n.id === selectedId ? { ...n, desc: e.target.value } : n)))}
                  className="w-full rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none" />
              </div>
              <div className="text-[11px] text-muted-foreground/60">
                <p>类型: {node.type}</p>
                <p>位置: ({Math.round(node.x)}, {Math.round(node.y)})</p>
              </div>
              {node.type !== "start" && (
                <button onClick={() => deleteNode(node.id)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-destructive/20 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> 删除节点
                </button>
              )}
            </div>
          );
        })() : (
          <div className="flex flex-col items-center gap-2 p-6 text-center">
            <p className="text-xs text-muted-foreground/60">点击节点查看属性</p>
            <p className="text-[11px] text-muted-foreground/40">从输出端口拖向另一节点可连线</p>
          </div>
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════
   测试对话面板
   ══════════════════════════════════════════ */
function TestChatPanel({ agent }: { agent: AgentConfig }) {
  const [messages, setMessages] = useState<TestMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages]);

  useEffect(() => {
    return () => { cancelRef.current?.(); };
  }, []);

  const send = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    setMessages((prev) => [...prev, { role: "user", content: text.trim() }, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setIsStreaming(true);

    const reply = getAgentReply(agent, text.trim());
    cancelRef.current = mockSSEStream(reply,
      (chunk) => {
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last.role === "assistant") u[u.length - 1] = { ...last, content: last.content + chunk };
          return u;
        });
      },
      () => {
        setMessages((prev) => {
          const u = [...prev];
          const last = u[u.length - 1];
          if (last.role === "assistant") u[u.length - 1] = { ...last, streaming: false };
          return u;
        });
        setIsStreaming(false);
        cancelRef.current = null;
      },
    );
  }, [isStreaming, agent]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages((prev) => {
      const u = [...prev];
      const last = u[u.length - 1];
      if (last?.role === "assistant" && last.streaming) u[u.length - 1] = { ...last, streaming: false };
      return u;
    });
    setIsStreaming(false);
  }, []);

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquare className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-medium text-foreground">测试对话</span>
        {messages.length > 0 && (
          <button onClick={() => { cancelRef.current?.(); setMessages([]); setIsStreaming(false); }}
            className="ml-auto text-[11px] text-muted-foreground hover:text-destructive">清空</button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-lg">{agent.icon}</div>
              <p className="text-sm font-medium text-foreground">{agent.name}</p>
              <p className="text-xs text-muted-foreground">输入消息测试智能体效果</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2", msg.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs",
                msg.role === "user" ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white" : "bg-secondary ring-1 ring-border")}>
                {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <span className="text-sm">{agent.icon}</span>}
              </div>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                msg.role === "user"
                  ? "rounded-tr-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                  : "rounded-tl-md bg-secondary text-foreground ring-1 ring-border")}>
                {msg.role === "assistant" ? (
                  <>
                    <MarkdownContent content={msg.content} streaming={msg.streaming} />
                    {msg.streaming && !msg.content && (
                      <span className="inline-flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
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
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
            placeholder="输入测试消息…" disabled={isStreaming}
            className="h-[40px] flex-1 rounded-xl border border-border bg-input px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50" />
          {isStreaming ? (
            <Button onClick={handleStop} size="icon" variant="outline"
              className="h-[40px] w-[40px] shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => send(input)} size="icon" disabled={!input.trim()}
              className="h-[40px] w-[40px] shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 disabled:opacity-40">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════
   主页面
   ══════════════════════════════════════════ */
export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  // 从 demo 数据中查找，找不到就创建空白
  const [agent, setAgent] = useState<AgentConfig>(() => {
    const demos = createDemoAgents();
    return demos.find((a) => a.id === agentId) ?? {
      id: agentId,
      name: "新建智能体",
      description: "",
      icon: "🤖",
      model: "gpt-4o",
      systemPrompt: "你是一个智能助手。\n\n用户问题：{{input}}",
      temperature: 0.7,
      maxTokens: 2048,
      tools: getAvailableTools(),
      knowledgeBase: [],
      status: "draft" as const,
      mode: "simple" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [mode, setMode] = useState<"simple" | "advanced">(agent.mode);
  const [showTest, setShowTest] = useState(false);
  const [saved, setSaved] = useState(false);

  // 编排模式状态
  const [flowState, setFlowState] = useState(() => createDefaultFlow());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/agent-flow")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-500/20 text-lg">
            {agent.icon}
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">{agent.name}</h1>
            <p className="text-[11px] text-muted-foreground">
              {agent.status === "published" ? "已发布" : "草稿"} · {agent.model}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 模式切换 */}
          <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
            {(["simple", "advanced"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {m === "simple" ? "简单模式" : "编排模式"}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTest(!showTest)}>
            <Play className="h-3.5 w-3.5" />
            {showTest ? "关闭测试" : "测试运行"}
          </Button>
          <Button size="sm" className={cn("gap-1.5 transition-all", saved ? "bg-emerald-600" : "bg-gradient-to-r from-indigo-500 to-violet-600")}
            onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
            {saved ? "已保存" : "保存"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {mode === "simple" ? (
          <SimpleMode agent={agent} onChange={setAgent} />
        ) : (
          <WorkflowMode
            nodes={flowState.nodes}
            edges={flowState.edges}
            selectedId={selectedNodeId}
            onNodesChange={(n) => setFlowState((s) => ({ ...s, nodes: n }))}
            onEdgesChange={(e) => setFlowState((s) => ({ ...s, edges: e }))}
            onSelect={setSelectedNodeId}
          />
        )}

        {/* 测试面板 */}
        {showTest && <TestChatPanel agent={agent} />}
      </div>
    </div>
  );
}
