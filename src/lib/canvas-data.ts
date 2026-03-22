/* ── Canvas 画布页面的数据定义和工具函数 ── */

import { Brain, GitFork, Wrench, CirclePlay, CircleStop } from "lucide-react";
import type { Node, Edge } from "@xyflow/react";

export interface NodeTypeItem {
  type: string;
  label: string;
  icon: typeof Brain;
  color: string;
  desc: string;
  defaultData: Record<string, unknown>;
}

export const NODE_TYPES_LIST: NodeTypeItem[] = [
  { type: "start", label: "开始节点", icon: CirclePlay, color: "#22c55e", desc: "流程的入口，接收用户输入并传递给下游节点", defaultData: {} },
  { type: "llm", label: "LLM 调用", icon: Brain, color: "#6366f1", desc: "调用大语言模型处理文本，通过 System Prompt 控制行为", defaultData: { model: "gpt-4o", systemPrompt: "你是一个智能助手，请根据 {{input}} 回答用户问题。", temperature: 0.7 } },
  { type: "condition", label: "条件判断", icon: GitFork, color: "#f59e0b", desc: "根据上游输出做分支判断，走不同的处理路径", defaultData: { expression: "" } },
  { type: "tool", label: "工具调用", icon: Wrench, color: "#8b5cf6", desc: "调用外部工具（搜索、数据库、API 等）获取数据", defaultData: { toolType: "web_search", params: "" } },
  { type: "end", label: "结束节点", icon: CircleStop, color: "#ef4444", desc: "流程的出口，将最终结果返回给用户", defaultData: {} },
];

export const NODE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  NODE_TYPES_LIST.map((n) => [n.type, n.color])
);

export const NODE_DESC_MAP: Record<string, string> = Object.fromEntries(
  NODE_TYPES_LIST.map((n) => [n.type, n.desc])
);

export const TOOL_LABELS: Record<string, string> = {
  web_search: "网络搜索",
  code_exec: "代码执行",
  db_query: "数据库查询",
  api_call: "API 调用",
};

export const MODELS = ["gpt-4o", "gpt-3.5-turbo", "claude-3.5", "qwen-max", "deepseek-v3"];

export const NODE_TIPS: Record<string, string> = {
  "1": "💡 这是流程起点。在真实产品中，用户在聊天框输入的内容会从这里进入流程。",
  "2": "💡 第一个 LLM 节点通常做「意图识别」— 判断用户想干什么，而不是直接回答。温度设低（0.3）让输出更确定。",
  "3": "💡 条件节点是流程的「岔路口」。根据意图识别的结果，决定走搜索还是直接回复。这就是 Agent 的「决策能力」。",
  "4": "💡 工具节点让 Agent 有了「手脚」— 能搜索、查数据库、调 API。这是 Agent 和普通聊天机器人的核心区别。",
  "5": "💡 如果不需要搜索，就走这条路直接回复。温度设高一点（0.7）让回复更自然。",
  "6": "💡 拿到搜索结果后，再用 LLM 总结。注意 prompt 里用了 {{context}} 变量把搜索结果传进来。",
  "7": "💡 所有分支最终汇聚到结束节点。一个好的流程应该确保每条路径都能到达终点。",
};

export const INITIAL_NODES: Node[] = [
  { id: "1", type: "start", position: { x: 50, y: 200 }, data: { label: "用户输入" } },
  { id: "2", type: "llm", position: { x: 300, y: 80 }, data: { label: "意图识别", model: "gpt-4o", systemPrompt: "请分析用户输入 {{input}} 的意图，判断是否需要搜索。", temperature: 0.3 } },
  { id: "3", type: "condition", position: { x: 580, y: 200 }, data: { label: "需要搜索？", expression: 'intent === "search"' } },
  { id: "4", type: "tool", position: { x: 850, y: 80 }, data: { label: "网络搜索", toolType: "web_search", params: '{"query": "{{input}}"}' } },
  { id: "5", type: "llm", position: { x: 850, y: 340 }, data: { label: "直接回复", model: "gpt-4o", systemPrompt: "请友好地回答用户问题：{{input}}", temperature: 0.7 } },
  { id: "6", type: "llm", position: { x: 1120, y: 80 }, data: { label: "总结搜索结果", model: "gpt-4o", systemPrompt: "根据搜索结果 {{context}} 回答用户问题：{{input}}", temperature: 0.5 } },
  { id: "7", type: "end", position: { x: 1120, y: 340 }, data: { label: "输出结果" } },
];

export const INITIAL_EDGES: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e2-3", source: "2", target: "3", animated: true },
  { id: "e3-4", source: "3", target: "4", label: "是", style: { stroke: "#22c55e" } },
  { id: "e3-5", source: "3", target: "5", label: "否", style: { stroke: "#f59e0b" } },
  { id: "e4-6", source: "4", target: "6", animated: true },
  { id: "e6-7", source: "6", target: "7", animated: true },
  { id: "e5-7", source: "5", target: "7", animated: true },
];

export interface DebugLog {
  nodeId: string;
  label: string;
  type: string;
  color: string;
  status: "running" | "done";
  output?: string;
  duration?: number;
}

export function mockNodeOutput(node: Node): string {
  const d = node.data as Record<string, unknown>;
  const label = (d.label as string) || "";
  switch (node.type) {
    case "start": return '用户输入: "帮我搜索 Vue3 最新特性"';
    case "llm":
      if (label.includes("意图")) return '{ intent: "search", confidence: 0.95 }';
      if (label.includes("总结")) return "根据搜索结果，Vue 3.5 引入了响应式 Props 解构…";
      return "好的，我来帮你回答这个问题…";
    case "condition": return '判断结果: true → 走"是"分支';
    case "tool": return '搜索结果: [{ title: "Vue 3.5 新特性", url: "…" }]';
    case "end": return "流程结束，输出最终结果";
    default: return "";
  }
}

export function getExecutionPath(nodes: Node[], edges: Edge[]): Node[] {
  const start = nodes.find((n) => n.type === "start");
  if (!start) return [];
  const path: Node[] = [];
  const visited = new Set<string>();
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    path.push(node);
    const outs = edges.filter((e) => e.source === id);
    if (node.type === "condition") {
      const yes = outs.find((e) => e.label === "是") || outs[0];
      if (yes) queue.push(yes.target);
    } else {
      outs.forEach((e) => queue.push(e.target));
    }
  }
  return path;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
