"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  PenLine, Sparkles, Languages, Expand, Shrink, SmilePlus,
  Wand2, Send, MessageSquare,
  Bold, Italic, Heading1, Heading2, List, Quote, Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { mockSSEStream } from "@/lib/mock-sse";
import { MarkdownContent } from "@/components/chat/markdown-content";

/* ── 示例文章 ── */
const SAMPLE_ARTICLE = `<h1>AI 如何重塑内容创作工作流</h1>
<p>在过去的两年里，生成式 AI 彻底改变了内容创作的方式。从文案撰写到代码生成，从图片创作到视频制作，AI 正在成为每个创作者的得力助手。</p>
<h2>写作场景的变革</h2>
<p>传统的写作流程是线性的：构思、起草、修改、定稿。而 AI 辅助写作打破了这个线性流程，让创作者可以在任何阶段获得 AI 的帮助：</p>
<ul>
<li><strong>构思阶段</strong> — AI 可以根据主题生成大纲、提供灵感</li>
<li><strong>起草阶段</strong> — AI 续写、扩写，帮助快速产出初稿</li>
<li><strong>修改阶段</strong> — AI 润色、缩写、调整语气和风格</li>
<li><strong>翻译阶段</strong> — AI 实现高质量的多语言转换</li>
</ul>
<h2>交互模式的创新</h2>
<p>AI 写作工具的交互设计是产品成功的关键。好的 AI 写作体验应该是无缝的——AI 融入写作流程，而不是打断它。</p>
<p>目前主流的交互模式包括：内联补全（光标处续写）、选中操作（对选中文本进行润色/翻译/改写）、侧边栏对话（通过自然语言指令控制写作）。</p>
<blockquote>好的工具应该像空气一样——你感受不到它的存在，但离开它就无法呼吸。</blockquote>
<p>这段文字是一篇示例文章。你可以选中任意文字，使用浮出的 AI 工具栏进行润色、翻译、扩写等操作。也可以将光标放在文末，点击"AI 续写"按钮体验流式续写效果。</p>`;

/* ── AI 操作类型 ── */
type AIAction = "polish" | "translate" | "expand" | "condense" | "tone";

const AI_ACTIONS: { type: AIAction; label: string; icon: typeof Sparkles; desc: string }[] = [
  { type: "polish", label: "润色", icon: Wand2, desc: "优化表达，提升文采" },
  { type: "translate", label: "翻译", icon: Languages, desc: "中英互译" },
  { type: "expand", label: "扩写", icon: Expand, desc: "丰富细节，增加内容" },
  { type: "condense", label: "缩写", icon: Shrink, desc: "精简表达，保留核心" },
  { type: "tone", label: "改语气", icon: SmilePlus, desc: "调整为更专业/轻松的语气" },
];


/* ── Mock AI 回复 ── */
function getAIWritingReply(action: AIAction, text: string): string {
  switch (action) {
    case "polish":
      return `在过去两年间，生成式 AI 以前所未有的速度重塑了内容创作的版图。无论是精雕细琢的文案、逻辑严密的代码，还是令人惊叹的视觉作品，AI 正从"工具"进化为创作者不可或缺的"协作伙伴"。`;
    case "translate":
      if (/[\u4e00-\u9fff]/.test(text)) {
        return `In the past two years, generative AI has fundamentally transformed the way content is created. From copywriting to code generation, from image creation to video production, AI is becoming an indispensable assistant for every creator.`;
      }
      return `在过去的两年里，生成式 AI 从根本上改变了内容创作的方式。从文案撰写到代码生成，从图片创作到视频制作，AI 正在成为每个创作者不可或缺的助手。`;
    case "expand":
      return `在过去的两年里，生成式 AI 彻底改变了内容创作的方式。这场变革的速度之快、范围之广，超出了大多数人的预期。

从文案撰写到代码生成，从图片创作到视频制作，AI 正在成为每个创作者的得力助手。据统计，2025 年全球已有超过 60% 的内容创作者在日常工作中使用 AI 工具，而这一比例在 2023 年初还不到 15%。

更值得关注的是，AI 不仅提升了创作效率，还降低了创作门槛。过去需要专业设计师才能完成的视觉作品，现在普通用户通过自然语言描述就能生成。这种"创作民主化"的趋势正在深刻影响整个内容产业的格局。`;
    case "condense":
      return `生成式 AI 正在重塑内容创作——从文案、代码到图片、视频，AI 已成为创作者的核心工具。`;
    case "tone":
      return `嘿，你有没有发现？这两年 AI 简直把内容创作这件事翻了个底朝天。写文案、敲代码、画图、做视频——哪哪都有 AI 的身影。说它是"助手"都谦虚了，简直是创作者的最佳拍档。`;
    default:
      return text;
  }
}

function getContinuation(): string {
  const continuations = [
    `<h2>未来展望</h2><p>展望 2026 年及以后，AI 写作工具将朝着更加智能化和个性化的方向发展。我们可以预见以下几个趋势：</p><p>首先，<strong>上下文理解能力</strong>将大幅提升。AI 不再只是基于当前段落生成内容，而是能够理解整篇文章的结构、论点和风格，给出更连贯的建议。</p><p>其次，<strong>多模态融合</strong>将成为标配。写作过程中，AI 可以自动建议配图、生成图表、甚至创建短视频来丰富内容表达。</p><p>最后，<strong>个人风格学习</strong>将让 AI 真正成为"你的"写作助手——它会学习你的用词习惯、句式偏好和表达风格，生成的内容越来越像"你写的"。</p>`,
    `<p>值得注意的是，AI 写作并不意味着取代人类创作者。恰恰相反，它释放了创作者的时间和精力，让他们能够专注于更高层次的创意工作——构思独特的观点、设计叙事结构、注入个人情感。</p><p>正如摄影术的发明没有消灭绘画，反而催生了印象派等新的艺术流派一样，AI 写作工具也将催生全新的内容创作范式。</p>`,
  ];
  return continuations[Math.floor(Math.random() * continuations.length)];
}

function getChatReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("大纲") || lower.includes("结构") || lower.includes("outline")) {
    return `## 建议大纲\n\n1. **引言** — AI 写作的现状与趋势\n2. **核心场景** — 续写、润色、翻译、改写\n3. **交互设计** — 内联补全 vs 侧边栏 vs 浮窗\n4. **技术实现** — SSE 流式、contentEditable、Selection API\n5. **产品案例** — Notion AI、飞书文档、Cursor\n6. **未来展望** — 多模态融合、个人风格学习`;
  }
  if (lower.includes("标题") || lower.includes("title")) {
    return `几个标题建议：\n\n1. 「AI 如何重塑内容创作工作流」\n2. 「从辅助到协作：AI 写作的进化之路」\n3. 「写作的未来：当 AI 成为你的文字搭档」\n4. 「AI Native 写作体验设计指南」\n\n> 建议选第 2 个，既有叙事感又点明了趋势。`;
  }
  if (lower.includes("开头") || lower.includes("引言") || lower.includes("intro")) {
    return `试试这个开头：\n\n> 2024 年，一个产品经理用 30 分钟写完了过去需要 3 天的方案。不是因为他变快了，而是他的 AI 助手变强了。\n\n这种"具体场景 + 反转"的开头能快速抓住读者注意力。`;
  }
  return `关于「${input}」，我有几点建议：\n\n1. 可以从具体案例切入，增强说服力\n2. 适当加入数据支撑，提升专业感\n3. 结尾可以留一个开放性问题，引发读者思考\n\n需要我帮你针对某个段落具体修改吗？`;
}

/* ── 侧边对话 ── */
interface ChatMsg { role: "user" | "assistant"; content: string; streaming?: boolean }


/* ── 浮动 AI 工具栏 ── */
function FloatingToolbar({
  position,
  onAction,
}: {
  position: { x: number; y: number };
  onAction: (action: AIAction) => void;
}) {
  /* 边界检测：工具栏约 320px 宽、48px 高，防止溢出视口 */
  const barW = 320, barH = 48, pad = 8;
  const left = Math.max(pad, Math.min(position.x, window.innerWidth - barW - pad));
  const top = position.y - barH - pad < pad ? position.y + 28 : position.y - barH - pad;

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-xl shadow-black/20 animate-in fade-in zoom-in-95 duration-150"
      style={{ left, top }}
    >
      {AI_ACTIONS.map((a) => (
        <button
          key={a.type}
          onClick={() => onAction(a.type)}
          title={a.desc}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <a.icon className="h-3.5 w-3.5" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

/* ── AI 操作结果面板 ── */
function AIResultPanel({
  action,
  original,
  result,
  streaming,
  onAccept,
  onDiscard,
}: {
  action: AIAction;
  original: string;
  result: string;
  streaming: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const actionLabel = AI_ACTIONS.find((a) => a.type === action)?.label ?? "";
  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 animate-in slide-in-from-top-2 duration-200">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-medium text-indigo-400">AI {actionLabel}</span>
        {streaming && <span className="text-[11px] text-muted-foreground animate-pulse">生成中…</span>}
      </div>
      <div className="mb-1 text-[11px] text-muted-foreground/60">原文：</div>
      <div className="mb-3 rounded-lg bg-card/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">{original}</div>
      <div className="mb-1 text-[11px] text-indigo-400/60">AI 结果：</div>
      <div className="mb-3 rounded-lg bg-card px-3 py-2 text-sm leading-relaxed text-foreground ring-1 ring-indigo-500/10">
        {result || <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" /></span>}
      </div>
      {!streaming && result && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onAccept} className="gap-1.5 bg-indigo-500 hover:bg-indigo-600">
            <Wand2 className="h-3.5 w-3.5" /> 采纳
          </Button>
          <Button size="sm" variant="outline" onClick={onDiscard}>放弃</Button>
        </div>
      )}
    </div>
  );
}


/* ── 主页面 ── */
export default function AIWritingPage() {
  /* ---- refs ---- */
  const editorRef = useRef<HTMLDivElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const chatCancelRef = useRef<(() => void) | null>(null);

  /* ---- state ---- */
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [selRange, setSelRange] = useState<Range | null>(null);

  const [aiAction, setAiAction] = useState<AIAction | null>(null);
  const [aiOriginal, setAiOriginal] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiStreaming, setAiStreaming] = useState(false);

  const [continuing, setContinuing] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: "你好，我是你的写作助手。可以帮你生成大纲、优化标题、改写段落。有什么需要帮忙的？" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  const [wordCount, setWordCount] = useState(0);

  /* ---- 字数统计 ---- */
  const updateWordCount = useCallback(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || "";
    setWordCount(text.replace(/\s/g, "").length);
  }, []);

  /* 初始内容 + 字数 — 挂载后注入 HTML，避免 SSR hydration mismatch */
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = SAMPLE_ARTICLE;
      const raf = requestAnimationFrame(() => {
        if (editorRef.current) {
          const text = editorRef.current.innerText || "";
          setWordCount(text.replace(/\s/g, "").length);
        }
      });
      return () => cancelAnimationFrame(raf);
    }
  }, []);

  /* ---- 选区检测 ---- */
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) {
      setToolbarPos(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text) { setToolbarPos(null); return; }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectedText(text);
    setSelRange(range.cloneRange());
    setToolbarPos({ x: rect.left + rect.width / 2 - 160, y: rect.top });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [handleSelectionChange]);

  /* ---- AI 操作 ---- */
  const handleAIAction = useCallback((action: AIAction) => {
    if (!selectedText) return;
    setToolbarPos(null);
    setAiAction(action);
    setAiOriginal(selectedText);
    setAiResult("");
    setAiStreaming(true);
    const reply = getAIWritingReply(action, selectedText);
    cancelRef.current = mockSSEStream(
      reply,
      (chunk) => setAiResult((p) => p + chunk),
      () => setAiStreaming(false),
      25,
    );
  }, [selectedText]);

  const handleAccept = useCallback(() => {
    if (!selRange || !editorRef.current) { setAiAction(null); return; }
    try {
      // 验证 selRange 仍在编辑器内
      if (!editorRef.current.contains(selRange.startContainer)) { setAiAction(null); return; }
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(selRange);
      document.execCommand("insertText", false, aiResult);
    } catch {
      // selRange 已失效（用户点击了其他位置），静默忽略
    }
    setAiAction(null);
    setAiResult("");
    setSelRange(null);
    updateWordCount();
  }, [selRange, aiResult, updateWordCount]);

  const handleDiscard = useCallback(() => {
    setAiAction(null);
    setAiResult("");
  }, []);

  /* ---- AI 续写（打字机效果） ---- */
  const handleContinue = useCallback(() => {
    if (continuing || !editorRef.current) return;
    setContinuing(true);
    const continuation = getContinuation();
    const el = editorRef.current;
    el.focus();
    const sel = window.getSelection();
    sel?.selectAllChildren(el);
    sel?.collapseToEnd();

    /**
     * 逐字符解析 HTML 并追加到编辑器，实现打字机效果。
     * 遇到 `<tag>` 时创建 DOM 元素，文本内容逐字追加到当前节点。
     */
    let currentNode: Node | null = null; // 当前正在写入的文本节点的父元素
    let buf = ""; // 标签缓冲
    let inTag = false;

    const scrollToBottom = () => {
      const wrap = editorWrapRef.current;
      if (wrap) wrap.scrollTop = wrap.scrollHeight;
    };

    const moveCursorToEnd = () => {
      const s = window.getSelection();
      if (s && el) { s.selectAllChildren(el); s.collapseToEnd(); }
    };

    const appendChar = (ch: string) => {
      if (!currentNode) {
        // 没有当前节点时，创建一个 <p> 作为容器
        currentNode = document.createElement("p");
        el.appendChild(currentNode);
      }
      // 追加文本字符到当前节点
      const lastChild = currentNode.lastChild;
      if (lastChild && lastChild.nodeType === Node.TEXT_NODE) {
        lastChild.textContent += ch;
      } else {
        currentNode.appendChild(document.createTextNode(ch));
      }
      moveCursorToEnd();
    };

    const handleOpenTag = (tag: string) => {
      // 解析标签名和属性，如 <strong>、<li>
      const match = tag.match(/^<(\w+)/);
      if (!match) return;
      const tagName = match[1].toLowerCase();
      const newEl = document.createElement(tagName);

      // 块级元素追加到编辑器根，内联元素追加到当前节点
      const blockTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "div", "section"]);
      if (blockTags.has(tagName)) {
        // li 追加到最近的 ul/ol
        if (tagName === "li" && currentNode && ["UL", "OL"].includes((currentNode as Element).tagName)) {
          currentNode.appendChild(newEl);
        } else {
          el.appendChild(newEl);
        }
        currentNode = newEl;
      } else {
        // 内联元素（strong, em 等）追加到当前块级节点
        if (currentNode) {
          currentNode.appendChild(newEl);
          currentNode = newEl;
        } else {
          const p = document.createElement("p");
          p.appendChild(newEl);
          el.appendChild(p);
          currentNode = newEl;
        }
      }
    };

    const handleCloseTag = (tag: string) => {
      const match = tag.match(/^<\/(\w+)/);
      if (!match) return;
      const tagName = match[1].toLowerCase();
      // 向上回溯到对应标签的父节点
      let node = currentNode as Element | null;
      while (node && node !== el) {
        if (node.tagName?.toLowerCase() === tagName) {
          currentNode = node.parentElement === el ? null : node.parentElement;
          scrollToBottom();
          return;
        }
        node = node.parentElement;
      }
      currentNode = null;
    };

    cancelRef.current = mockSSEStream(
      continuation,
      (chunk) => {
        for (const ch of chunk) {
          if (ch === "<") {
            inTag = true;
            buf = "<";
          } else if (ch === ">" && inTag) {
            buf += ">";
            inTag = false;
            if (buf.startsWith("</")) {
              handleCloseTag(buf);
            } else {
              handleOpenTag(buf);
            }
            buf = "";
          } else if (inTag) {
            buf += ch;
          } else {
            // 普通文本字符 — 跳过 HTML 实体的分号等
            appendChar(ch);
          }
        }
      },
      () => {
        moveCursorToEnd();
        setContinuing(false);
        updateWordCount();
      },
      20,
    );
  }, [continuing, updateWordCount]);

  /* ---- 编辑器工具栏命令 ---- */
  const execCmd = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    updateWordCount();
  }, [updateWordCount]);

  /* ---- 聊天 ---- */
  const sendChat = useCallback(() => {
    const text = chatInput.trim();
    if (!text || chatStreaming) return;
    setChatInput("");
    setChatMsgs((p) => [...p, { role: "user", content: text }]);
    setChatStreaming(true);
    const reply = getChatReply(text);
    setChatMsgs((p) => [...p, { role: "assistant", content: "", streaming: true }]);
    chatCancelRef.current = mockSSEStream(
      reply,
      (chunk) => {
        setChatMsgs((p) => {
          const next = [...p];
          const last = next[next.length - 1];
          if (last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      },
      () => {
        setChatStreaming(false);
        setChatMsgs((p) => {
          const next = [...p];
          const last = next[next.length - 1];
          if (last.role === "assistant") {
            next[next.length - 1] = { ...last, streaming: false };
          }
          return next;
        });
      },
      25,
    );
  }, [chatInput, chatStreaming]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  /* ---- cleanup ---- */
  useEffect(() => () => { cancelRef.current?.(); chatCancelRef.current?.(); }, []);

  /* ---- render ---- */
  return (
    <div className="flex h-full">
      {/* 左侧：编辑器 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center gap-1 border-b border-border bg-card/50 px-4 py-2">
          <div className="flex items-center gap-2 mr-4">
            <PenLine className="h-5 w-5 text-indigo-400" />
            <span className="text-sm font-medium">AI 写作</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => execCmd("bold")} title="加粗" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Bold className="h-4 w-4" /></button>
            <button onClick={() => execCmd("italic")} title="斜体" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Italic className="h-4 w-4" /></button>
            <button onClick={() => execCmd("formatBlock", "h1")} title="标题 1" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Heading1 className="h-4 w-4" /></button>
            <button onClick={() => execCmd("formatBlock", "h2")} title="标题 2" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Heading2 className="h-4 w-4" /></button>
            <button onClick={() => execCmd("insertUnorderedList")} title="无序列表" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><List className="h-4 w-4" /></button>
            <button onClick={() => execCmd("formatBlock", "blockquote")} title="引用" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Quote className="h-4 w-4" /></button>
            <button onClick={() => execCmd("undo")} title="撤销" className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Undo2 className="h-4 w-4" /></button>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground/60">{wordCount} 字</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleContinue}
              disabled={continuing}
              className="gap-1.5 text-[12px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {continuing ? "续写中…" : "AI 续写"}
            </Button>
            <button
              onClick={() => setChatOpen((p) => !p)}
              title="写作助手"
              className={cn(
                "rounded-md p-1.5 transition-colors",
                chatOpen ? "bg-indigo-500/20 text-indigo-400" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI 结果面板 */}
        {aiAction && (
          <AIResultPanel
            action={aiAction}
            original={aiOriginal}
            result={aiResult}
            streaming={aiStreaming}
            onAccept={handleAccept}
            onDiscard={handleDiscard}
          />
        )}

        {/* 编辑区 */}
        <div ref={editorWrapRef} className="flex-1 overflow-auto">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={updateWordCount}
            className="prose prose-invert mx-auto max-w-2xl px-8 py-10 outline-none min-h-full
              empty:before:content-['加载中…'] empty:before:text-muted-foreground/30 empty:before:text-sm
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:text-foreground
              [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-foreground
              [&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:text-muted-foreground
              [&_ul]:mb-4 [&_ul]:pl-6 [&_li]:text-[15px] [&_li]:leading-relaxed [&_li]:mb-1.5 [&_li]:text-muted-foreground
              [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-500/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground/80
              [&_strong]:text-foreground [&_strong]:font-semibold"
          />
        </div>

        {/* 浮动工具栏 */}
        {toolbarPos && !aiAction && (
          <FloatingToolbar position={toolbarPos} onAction={handleAIAction} />
        )}
      </div>

      {/* 右侧：写作助手聊天 */}
      {chatOpen && (
        <div className="flex w-80 flex-col border-l border-border bg-card/30">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-medium">写作助手</span>
          </div>
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="space-y-3 p-3">
              {chatMsgs.map((msg, i) => (
                <div key={`cm-${i}`} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                      msg.role === "user"
                        ? "bg-indigo-500 text-white"
                        : "bg-secondary text-foreground",
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownContent content={msg.content} />
                    ) : (
                      msg.content
                    )}
                    {msg.streaming && (
                      <span className="ml-1 inline-flex gap-0.5">
                        <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
                placeholder="问我任何写作问题…"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-indigo-500/30"
              />
              <Button size="icon" onClick={sendChat} disabled={chatStreaming || !chatInput.trim()} className="h-8 w-8 shrink-0">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
