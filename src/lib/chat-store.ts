/**
 * 对话状态管理（纯 React state，不引入额外依赖）
 * 支持多会话、新建、切换、删除
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

let _idCounter = 0;
export function genId() {
  return `chat-${Date.now()}-${++_idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

/** 从第一条用户消息提取标题，最多 20 字 */
export function extractTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "新对话";
  const text = first.content.replace(/\n/g, " ").trim();
  return text.length > 20 ? text.slice(0, 20) + "…" : text;
}

/** 预置演示对话 — 页面加载时不空白 */
export function createDemoSessions(): ChatSession[] {
  // 使用固定值避免 SSR/CSR hydration mismatch
  const now = 1710000000000; // 固定基准时间戳
  return [
    {
      id: "demo-session-1",
      title: "React Hook 代码示例",
      createdAt: now - 120000,
      messages: [
        {
          id: "demo-1-u1",
          role: "user",
          content: "请写一段 React Hook 的代码示例",
          timestamp: now - 120000,
        },
        {
          id: "demo-1-a1",
          role: "assistant",
          content: `好的，这是一个 React Hook 的示例：

\`\`\`typescript
import { useState, useCallback, useEffect } from 'react';

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const doubled = count * 2;

  const increment = useCallback(() => setCount(c => c + 1), []);
  const decrement = useCallback(() => setCount(c => c - 1), []);

  useEffect(() => {
    console.log('Counter mounted with value:', count);
  }, []);

  return { count, doubled, increment, decrement };
}
\`\`\`

这个 Hook 封装了一个计数器逻辑，支持递增、递减，并提供了一个派生值 \`doubled\`。你可以继续问我关于这段代码的问题。`,
          timestamp: now - 115000,
        },
        {
          id: "demo-1-u2",
          role: "user",
          content: "能详细解释一下这段代码吗？",
          timestamp: now - 60000,
        },
        {
          id: "demo-1-a2",
          role: "assistant",
          content: `好的，我来逐行解释这段代码：

1. **\`useState(initial)\`** — 创建一个响应式状态 \`count\`，初始值由参数传入，默认为 0

2. **\`const doubled = count * 2\`** — 这是一个派生值，每次 \`count\` 变化时组件重渲染，\`doubled\` 会自动重新计算

3. **\`useCallback\`** — 包裹 \`increment\` 和 \`decrement\`，确保函数引用稳定

4. **\`useEffect(fn, [])\`** — 空依赖数组意味着只在挂载时执行一次

> 这种把状态逻辑抽成自定义 Hook 的模式叫 **逻辑复用**，是 React Hooks 最核心的设计理念。`,
          timestamp: now - 55000,
        },
      ],
    },
    {
      id: "demo-session-2",
      title: "React 性能优化手段",
      createdAt: now - 3600000,
      messages: [
        {
          id: "demo-2-u1",
          role: "user",
          content: "React 项目有哪些常见的性能优化手段？",
          timestamp: now - 3600000,
        },
        {
          id: "demo-2-a1",
          role: "assistant",
          content: `React 项目常见的性能优化手段：

## 1. 渲染优化
- **React.memo** — 避免不必要的子组件重渲染
- **useMemo / useCallback** — 缓存计算结果和回调引用

## 2. 代码分割
- 动态 import + \`React.lazy\` + \`Suspense\`
- 路由级分割 — Next.js App Router 自动支持

## 3. 状态管理
> 关键原则：**状态下沉**，让状态尽可能靠近使用它的组件。`,
          timestamp: now - 3595000,
        },
      ],
    },
    {
      id: "demo-session-3",
      title: "Markdown 渲染效果",
      createdAt: now - 86400000,
      messages: [
        {
          id: "demo-3-u1",
          role: "user",
          content: "展示一下 Markdown 渲染效果",
          timestamp: now - 86400000,
        },
        {
          id: "demo-3-a1",
          role: "assistant",
          content: `# Markdown 渲染演示

## 支持的格式
- 无序列表
- **加粗**、*斜体*、\`行内代码\`

\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\`

> 这是一段引用文本。`,
          timestamp: now - 86395000,
        },
      ],
    },
  ];
}

/** 创建空白新对话 */
export function createEmptySession(): ChatSession {
  return {
    id: genId(),
    title: "新对话",
    messages: [],
    createdAt: Date.now(),
  };
}
