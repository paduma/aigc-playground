"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  BookOpen, Upload, FileText, Send, Bot, User,
  ChevronRight, Search, Loader2, Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { mockSSEStream } from "@/lib/mock-sse";
import { MarkdownContent } from "@/components/chat/markdown-content";

/* -- types -- */
interface DocItem {
  id: string; name: string; pages: number; size: string;
  chunks: number; status: "ready" | "parsing"; category: string;
}
interface Citation { docName: string; page: number; text: string; relevance: number }
interface RagReply { answer: string; citations: Citation[] }
interface Message {
  role: "user" | "assistant"; content: string;
  streaming?: boolean; citations?: Citation[];
}

/* -- docs -- */
const PRESET_DOCS: DocItem[] = [
  { id: "1", name: "React 19 官方文档.pdf", pages: 42, size: "3.2 MB", chunks: 128, status: "ready", category: "React" },
  { id: "2", name: "Next.js App Router 指南.pdf", pages: 36, size: "2.8 MB", chunks: 96, status: "ready", category: "Next.js" },
  { id: "3", name: "Tailwind CSS v4 迁移手册.md", pages: 18, size: "156 KB", chunks: 52, status: "ready", category: "CSS" },
  { id: "4", name: "React Server Components 深度解析.pdf", pages: 28, size: "2.1 MB", chunks: 84, status: "ready", category: "React" },
  { id: "5", name: "TypeScript 5.x 新特性.pdf", pages: 22, size: "1.8 MB", chunks: 68, status: "ready", category: "TypeScript" },
];

/* ── mock replies ── */
const R19_ANSWER = [
  "React 19 引入了几个重要的新特性：",
  "",
  "### React Compiler",
  "",
  "自动优化组件重渲染，不再需要手动 `useMemo` / `useCallback`：",
  "",
  "```jsx",
  "// React 19 之前 — 需要手动 memo",
  "const ExpensiveList = memo(({ items }) => {",
  "  const sorted = useMemo(() => items.sort(compareFn), [items]);",
  "  return sorted.map(item => <Item key={item.id} item={item} />);",
  "});",
  "",
  "// React 19 — Compiler 自动优化，无需手动 memo",
  "function ExpensiveList({ items }) {",
  "  const sorted = items.sort(compareFn);",
  "  return sorted.map(item => <Item key={item.id} item={item} />);",
  "}",
  "```",
  "",
  "### Server Components",
  "",
  "默认在服务端渲染，减少客户端 JS 体积。组件可以直接 `async/await` 获取数据：",
  "",
  "```tsx",
  "// Server Component — 直接在组件中获取数据",
  "async function UserProfile({ id }: { id: string }) {",
  "  const user = await db.user.findUnique({ where: { id } });",
  "  return <div>{user.name}</div>;",
  "}",
  "```",
  "",
  "### Actions & use() Hook",
  "",
  "- **Actions** — 新的表单处理方式，支持 `useActionState` 和 `useFormStatus`",
  "- **use() Hook** — 可以在组件中直接 await Promise 和读取 Context",
  "",
  "> 以上信息来自已上传的文档，点击引用可查看原文",
].join("\n");

const R19_CITATIONS: Citation[] = [
  { docName: "React 19 官方文档.pdf", page: 3, text: "React Compiler automatically memoizes components and hooks, eliminating the need for manual useMemo and useCallback. The compiler analyzes your code at build time.", relevance: 0.96 },
  { docName: "React 19 官方文档.pdf", page: 12, text: "Server Components run on the server and are not included in the client JavaScript bundle. They can directly access databases and server-side resources.", relevance: 0.92 },
  { docName: "React 19 官方文档.pdf", page: 18, text: "The new use() hook lets you read resources like Promises and Context during render. Unlike other hooks, use can be called inside loops and conditional statements.", relevance: 0.88 },
  { docName: "React Server Components 深度解析.pdf", page: 5, text: "RSC 的核心理念是将组件分为 Server 和 Client 两类，Server Component 在服务端执行，输出序列化的 React 树传递给客户端。", relevance: 0.79 },
];

const APPROUTER_ANSWER = [
  "## Next.js App Router 核心概念",
  "",
  "### 文件系统路由",
  "",
  "`app/` 目录下的 `page.tsx` 自动成为路由：",
  "",
  "```",
  "app/",
  "  page.tsx          -> /",
  "  about/",
  "    page.tsx        -> /about",
  "  blog/",
  "    page.tsx        -> /blog",
  "    [slug]/",
  "      page.tsx      -> /blog/:slug",
  "  layout.tsx        -> 根布局",
  "```",
  "",
  "### 布局嵌套",
  "",
  "`layout.tsx` 在导航时保持状态不销毁：",
  "",
  "```tsx",
  "// app/layout.tsx",
  "export default function RootLayout({ children }: { children: React.ReactNode }) {",
  "  return (",
  "    <html lang=\"zh\">",
  "      <body>",
  "        <Sidebar />",
  "        <main>{children}</main>",
  "      </body>",
  "    </html>",
  "  );",
  "}",
  "```",
  "",
  "### Server Components 优先",
  "",
  "默认所有组件都是 RSC，需要交互时加 `\"use client\"`：",
  "",
  "```tsx",
  "\"use client\";",
  "import { useState } from \"react\";",
  "",
  "export function Counter() {",
  "  const [count, setCount] = useState(0);",
  "  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;",
  "}",
  "```",
  "",
  "### 流式渲染",
  "",
  "配合 `loading.tsx` 和 `Suspense` 实现渐进式加载。",
  "",
  "> 引用来自 Next.js App Router 指南",
].join("\n");

const APPROUTER_CITATIONS: Citation[] = [
  { docName: "Next.js App Router 指南.pdf", page: 5, text: "The App Router uses file-system based routing where folders define routes. Each folder represents a route segment that maps to a URL segment.", relevance: 0.95 },
  { docName: "Next.js App Router 指南.pdf", page: 14, text: "Layouts are shared UI between routes. On navigation, layouts preserve state, remain interactive, and do not re-render.", relevance: 0.91 },
  { docName: "React Server Components 深度解析.pdf", page: 8, text: "在 Next.js App Router 中，所有组件默认为 Server Component。只有显式标记 use client 的组件才会在客户端执行。", relevance: 0.82 },
];

const TAILWIND_ANSWER = [
  "## Tailwind CSS v4 核心变化",
  "",
  "Tailwind v4 是一次重大架构升级，从 PostCSS 插件变成了独立的 CSS 引擎。",
  "",
  "### 零配置 CSS-first",
  "",
  "不再需要 `tailwind.config.js`，所有配置直接写在 CSS 中：",
  "",
  "```css",
  "/* app.css */",
  "@import \"tailwindcss\";",
  "",
  "@theme {",
  "  --color-primary: oklch(0.7 0.15 250);",
  "  --color-accent: oklch(0.8 0.12 160);",
  "  --font-display: \"Inter\", sans-serif;",
  "  --breakpoint-3xl: 1920px;",
  "}",
  "```",
  "",
  "### 性能飞跃",
  "",
  "- 全量构建速度提升 **5x**（Oxide 引擎，Rust 编写）",
  "- 增量构建速度提升 **100x+**",
  "- 不再依赖 PostCSS（可选集成）",
  "",
  "### 新的实用类",
  "",
  "```html",
  "<!-- 容器查询 -->",
  "<div class=\"@container\">",
  "  <div class=\"@lg:grid-cols-3 @sm:grid-cols-1\">...</div>",
  "</div>",
  "",
  "<!-- 3D 变换 -->",
  "<div class=\"rotate-x-12 rotate-y-6 perspective-800\">...</div>",
  "```",
  "",
  "### 迁移指南",
  "",
  "```bash",
  "# 自动迁移工具",
  "npx @tailwindcss/upgrade",
  "```",
  "",
  "主要变更：",
  "- `tailwind.config.js` -> `@theme` 指令",
  "- `@apply` 仍然支持但推荐直接用 utility",
  "- `darkMode: 'class'` -> 自动检测 `prefers-color-scheme`",
  "",
  "> 引用来自 Tailwind CSS v4 迁移手册",
].join("\n");

const TAILWIND_CITATIONS: Citation[] = [
  { docName: "Tailwind CSS v4 迁移手册.md", page: 1, text: "Tailwind CSS v4.0 is a ground-up rewrite of the framework, moving from a PostCSS plugin to a standalone CSS engine built with Rust (Oxide engine).", relevance: 0.97 },
  { docName: "Tailwind CSS v4 迁移手册.md", page: 6, text: "Configuration is now CSS-first using @theme directive. The tailwind.config.js file is no longer required.", relevance: 0.94 },
  { docName: "Tailwind CSS v4 迁移手册.md", page: 12, text: "Container queries, 3D transforms, and oklch color support are now built-in utilities without plugins.", relevance: 0.85 },
];

const RSC_ANSWER = [
  "## React Server Components 深度解析",
  "",
  "Server Components (RSC) 是 React 架构的根本性变革，将组件执行从客户端移到服务端。",
  "",
  "### 核心架构",
  "",
  "```",
  "+--------- Server ---------+",
  "| ServerComponent          |",
  "|   -> 直接访问数据库/FS    |",
  "|   -> 序列化 React 树      |",
  "+-------------|-------------+",
  "              v",
  "+--------- Client ---------+",
  "| ClientComponent          |",
  "|   -> 交互逻辑 useState   |",
  "|   -> 浏览器 API          |",
  "+--------------------------+",
  "```",
  "",
  "### Server vs Client Component",
  "",
  "```tsx",
  "// Server Component — 默认，无需标记",
  "async function ProductPage({ id }: { id: string }) {",
  "  const product = await db.product.findUnique({ where: { id } });",
  "  const reviews = await db.review.findMany({ where: { productId: id } });",
  "  return (",
  "    <div>",
  "      <h1>{product.name}</h1>",
  "      <AddToCartButton productId={id} />",
  "    </div>",
  "  );",
  "}",
  "```",
  "",
  "```tsx",
  "// Client Component — 需要交互时标记",
  "\"use client\";",
  "function AddToCartButton({ productId }: { productId: string }) {",
  "  const [loading, setLoading] = useState(false);",
  "  return (",
  "    <button onClick={() => addToCart(productId)} disabled={loading}>",
  "      加入购物车",
  "    </button>",
  "  );",
  "}",
  "```",
  "",
  "### 最佳实践",
  "",
  "1. **尽量让组件保持 Server** — 减少客户端 JS 体积",
  "2. **Client 边界尽量下推** — 只在需要交互的最小组件上加 `\"use client\"`",
  "3. **数据获取在 Server 完成** — 避免客户端 waterfall",
  "4. **使用 Suspense 做流式渲染** — 提升首屏速度",
  "",
  "> 引用来自 React Server Components 深度解析",
].join("\n");

const RSC_CITATIONS: Citation[] = [
  { docName: "React Server Components 深度解析.pdf", page: 2, text: "Server Components execute on the server and their code is never sent to the client. This means they can directly access databases, file systems, and internal services.", relevance: 0.98 },
  { docName: "React Server Components 深度解析.pdf", page: 10, text: "The key mental model: Server Components handle data fetching and static rendering, Client Components handle interactivity and browser APIs.", relevance: 0.93 },
  { docName: "React 19 官方文档.pdf", page: 12, text: "Server Components are the default in React 19. You only need to add use client directive when a component needs hooks like useState or useEffect.", relevance: 0.86 },
  { docName: "Next.js App Router 指南.pdf", page: 20, text: "In the App Router, you can mix Server and Client Components in the same route. The framework handles the serialization boundary automatically.", relevance: 0.78 },
];

const DEFAULT_ANSWER = [
  "根据已上传的文档，我找到了一些相关信息。",
  "",
  "在实际的 RAG 系统中，这里的流程是：",
  "",
  "1. **用户提问** -> 文本 Embedding（如 `text-embedding-3-small`）",
  "2. **向量数据库检索**最相关的文档片段（Top-K）",
  "3. 将检索到的片段作为 **Context** 注入 Prompt",
  "4. LLM 基于 Context 生成回答，并标注**引用来源**",
  "",
  "```python",
  "# 简化的 RAG 流程",
  "query_embedding = embed(user_query)",
  "chunks = vector_db.search(query_embedding, top_k=5)",
  "context = \"\\n\".join([c.text for c in chunks])",
  "prompt = f\"基于以下文档回答问题：\\n{context}\\n\\n问题：{user_query}\"",
  "answer = llm.generate(prompt)",
  "```",
  "",
  "> 这就是 RAG（Retrieval-Augmented Generation）的核心原理",
].join("\n");

const DEFAULT_CITATIONS: Citation[] = [
  { docName: "React 19 官方文档.pdf", page: 1, text: "This is a simulated citation from the uploaded document for demonstration purposes.", relevance: 0.52 },
];

const MOCK_REPLIES: Record<string, RagReply> = {
  "React 19": { answer: R19_ANSWER, citations: R19_CITATIONS },
  "App Router": { answer: APPROUTER_ANSWER, citations: APPROUTER_CITATIONS },
  "Tailwind": { answer: TAILWIND_ANSWER, citations: TAILWIND_CITATIONS },
  "Server Component": { answer: RSC_ANSWER, citations: RSC_CITATIONS },
  default: { answer: DEFAULT_ANSWER, citations: DEFAULT_CITATIONS },
};

function findRagReply(text: string): RagReply {
  for (const [key, val] of Object.entries(MOCK_REPLIES)) {
    if (key !== "default" && text.includes(key)) return val;
  }
  return MOCK_REPLIES.default;
}

/** 相关度颜色分级 */
function relevanceColor(r: number): string {
  if (r >= 0.9) return "text-emerald-400";
  if (r >= 0.8) return "text-sky-400";
  if (r >= 0.7) return "text-amber-400";
  return "text-muted-foreground/60";
}
function relevanceBg(r: number): string {
  if (r >= 0.9) return "bg-emerald-500/10 border-emerald-500/20";
  if (r >= 0.8) return "bg-sky-500/10 border-sky-500/20";
  if (r >= 0.7) return "bg-amber-500/10 border-amber-500/20";
  return "bg-secondary/30 border-border";
}

export default function RagPage() {
  const [docs, setDocs] = useState<DocItem[]>(PRESET_DOCS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docFilter, setDocFilter] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages]);

  useEffect(() => { return () => { cancelRef.current?.(); }; }, []);

  const categories = Array.from(new Set(docs.map((d) => d.category)));
  const filteredDocs = docs.filter((d) => {
    const matchSearch = !docSearch || d.name.toLowerCase().includes(docSearch.toLowerCase());
    const matchFilter = !docFilter || d.category === docFilter;
    return matchSearch && matchFilter;
  });

  const handleUpload = useCallback(() => {
    const newDoc: DocItem = {
      id: Date.now().toString(),
      name: "用户文档_" + (docs.length + 1) + ".pdf",
      pages: Math.floor(Math.random() * 30) + 5,
      size: (Math.random() * 5 + 0.5).toFixed(1) + " MB",
      chunks: 0, status: "parsing", category: "自定义",
    };
    setDocs((prev) => [...prev, newDoc]);
    setTimeout(() => {
      setDocs((prev) =>
        prev.map((d) => d.id === newDoc.id ? { ...d, status: "ready" as const, chunks: Math.floor(Math.random() * 80) + 20 } : d)
      );
    }, 2000);
  }, [docs.length]);

  const handleStop = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant" && last.streaming) copy[copy.length - 1] = { ...last, streaming: false };
      return copy;
    });
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return;
    const ragReply = findRagReply(text);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text.trim() },
      { role: "assistant", content: "", streaming: true },
    ]);
    setInput("");
    setIsStreaming(true);
    cancelRef.current = mockSSEStream(ragReply.answer, (chunk) => {
      setMessages((prev) => {
        const u = [...prev]; const last = u[u.length - 1];
        if (last.role === "assistant") u[u.length - 1] = { ...last, content: last.content + chunk };
        return u;
      });
    }, () => {
      setMessages((prev) => {
        const u = [...prev]; const last = u[u.length - 1];
        if (last.role === "assistant") u[u.length - 1] = { ...last, streaming: false, citations: ragReply.citations };
        return u;
      });
      setIsStreaming(false);
      cancelRef.current = null;
    });
  }, [isStreaming]);

  return (
    <div className="absolute inset-0 flex overflow-hidden">
      {/* 左侧：文档管理 */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-border bg-card/50">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-foreground">知识库</span>
          </div>
          <Button onClick={handleUpload} variant="ghost" size="sm" className="gap-1.5 text-xs">
            <Upload className="h-3.5 w-3.5" /> 上传
          </Button>
        </div>

        {/* 搜索 & 分类筛选 */}
        <div className="flex flex-col gap-2 border-b border-border p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input value={docSearch} onChange={(e) => setDocSearch(e.target.value)}
              placeholder="搜索文档..."
              className="h-8 w-full rounded-lg border border-border bg-input pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setDocFilter(null)}
              className={cn("rounded-md px-2 py-0.5 text-[10px] transition-colors",
                !docFilter ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary/50 text-muted-foreground hover:text-foreground")}>
              全部
            </button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setDocFilter(docFilter === cat ? null : cat)}
                className={cn("rounded-md px-2 py-0.5 text-[10px] transition-colors",
                  docFilter === cat ? "bg-emerald-500/15 text-emerald-400" : "bg-secondary/50 text-muted-foreground hover:text-foreground")}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-1.5 p-3">
            {filteredDocs.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/20">
                <div className="flex items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/60">
                      <span>{doc.pages} 页</span><span>·</span><span>{doc.size}</span>
                      {doc.status === "ready" && <><span>·</span><span>{doc.chunks} 片段</span></>}
                    </div>
                    {doc.status === "parsing" ? (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> 解析中...
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> 已就绪
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filteredDocs.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground/50">无匹配文档</p>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <div className="rounded-xl border border-border bg-secondary/30 p-3">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">RAG 流程</p>
            <div className="flex flex-col gap-1">
              {["文档上传 -> 分片", "文本 Embedding", "向量数据库存储", "用户提问 -> 检索 Top-K", "Context + Prompt -> LLM", "生成带引用的回答"].map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <ChevronRight className="h-2.5 w-2.5 shrink-0 text-emerald-400/60" /> {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 右侧：对话区 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20">
            <Search className="h-[18px] w-[18px] text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">RAG 知识库问答</h1>
            <p className="text-xs text-muted-foreground">基于文档的检索增强生成 · 带引用溯源</p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-1">
          <div className="flex flex-col gap-5 p-5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                  <Bot className="h-7 w-7 text-emerald-400/60" />
                </div>
                <p className="text-sm text-foreground/80">基于已上传文档回答你的问题</p>
                <p className="text-xs text-muted-foreground">每个回答都会标注引用来源和相关度评分</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["React 19 有什么新特性？", "App Router 怎么用？", "Tailwind v4 有什么变化？", "Server Component 是什么？"].map((q) => (
                    <button key={q} onClick={() => sendMessage(q)}
                      className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-emerald-500/30 hover:text-foreground">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, msgIdx) => {
              const isUser = msg.role === "user";
              return (
                <div key={msgIdx} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    isUser ? "bg-gradient-to-br from-indigo-500 to-violet-600" : "bg-card ring-1 ring-border",
                  )}>
                    {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className={cn("max-w-[75%]", isUser && "text-right")}>
                    <div className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      isUser
                        ? "rounded-tr-md bg-gradient-to-br from-indigo-500 to-violet-600 text-white"
                        : "rounded-tl-md bg-secondary text-foreground ring-1 ring-border",
                    )}>
                      {isUser ? msg.content : (
                        <>
                          <MarkdownContent content={msg.content} streaming={msg.streaming} />
                          {msg.streaming && (
                            <span className="mt-1 inline-flex items-center gap-1">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:0ms]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms]" />
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {/* 引用来源 — key 用 msgIdx-ci 防止跨消息冲突 */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1.5">
                        <p className="text-[11px] font-medium text-muted-foreground/60">
                          引用来源（{msg.citations.length} 条）
                        </p>
                        {msg.citations.map((cite, ci) => {
                          const citeKey = String(msgIdx) + "-" + String(ci);
                          const pct = Math.round(cite.relevance * 100);
                          return (
                            <button key={citeKey}
                              onClick={() => setExpandedCitation(expandedCitation === citeKey ? null : citeKey)}
                              className={cn("rounded-lg border px-3 py-2 text-left transition-all", relevanceBg(cite.relevance))}>
                              <div className="flex items-center gap-2 text-xs">
                                <FileText className="h-3 w-3 text-emerald-400" />
                                <span className="font-medium text-foreground">{cite.docName}</span>
                                <span className="text-muted-foreground/60">第 {cite.page} 页</span>
                                <span className={cn("ml-auto font-mono text-[10px] font-semibold", relevanceColor(cite.relevance))}>
                                  {pct}%
                                </span>
                              </div>
                              {expandedCitation === citeKey && (
                                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground italic">
                                  &ldquo;{cite.text}&rdquo;
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} className="h-4" />
          </div>
        </ScrollArea>

        {/* Input + Stop */}
        <div className="shrink-0 border-t border-border p-4">
          <div className="flex items-end gap-3">
            <input value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(input); }}
              placeholder="基于文档提问..."
              disabled={isStreaming}
              className="h-[48px] flex-1 rounded-xl border border-border bg-input px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50" />
            {isStreaming ? (
              <Button onClick={handleStop} size="icon" variant="outline"
                className="h-[48px] w-[48px] shrink-0 rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => sendMessage(input)} disabled={!input.trim()} size="icon"
                className="h-[48px] w-[48px] shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:shadow-none">
                <Send className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
