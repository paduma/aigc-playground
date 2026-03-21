"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  MessageSquare, Mic, BookOpen, Clapperboard,
  BarChart3, ClipboardList, Workflow,
  PenLine, ImagePlus, Video,
  ScanFace, Radio, PersonStanding,
  Sparkles, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

/* ── Sidebar 折叠状态 Context ── */
interface SidebarCtx { collapsed: boolean; toggle: () => void }
const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => { } });
export const useSidebar = () => useContext(SidebarContext);

const COLLAPSE_BREAKPOINT = 1400;

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  /* 窄视口自动折叠侧边栏 */
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COLLAPSE_BREAKPOINT}px)`);
    const handle = (e: MediaQueryListEvent | MediaQueryList) => setCollapsed(e.matches);
    handle(mq);                       // 初始化
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

interface NavItem { href: string; icon: typeof MessageSquare; label: string }
interface NavGroup { title: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    title: "理解与对话",
    items: [
      { href: "/chat", icon: MessageSquare, label: "多模态对话" },
      { href: "/voice", icon: Mic, label: "语音对话" },
      { href: "/rag", icon: BookOpen, label: "RAG 知识库" },
      { href: "/video-understand", icon: Clapperboard, label: "视频理解" },
    ],
  },
  {
    title: "智能体",
    items: [
      { href: "/expert-agent", icon: BarChart3, label: "数据分析 Agent" },
      { href: "/diagnose", icon: ClipboardList, label: "对话式表单 Agent" },
      { href: "/agent-flow", icon: Workflow, label: "Agent 编排工作台" },
    ],
  },
  {
    title: "内容创作",
    items: [
      { href: "/ai-writing", icon: PenLine, label: "AI 写作" },
      { href: "/image-gen", icon: ImagePlus, label: "图片生成" },
      { href: "/video-gen", icon: Video, label: "AI 视频生成" },
    ],
  },
  {
    title: "实时与具身",
    items: [
      { href: "/digital-human", icon: ScanFace, label: "数字人直播" },
      { href: "/realtime-video", icon: Radio, label: "实时通信" },
      { href: "/pose-skeleton", icon: PersonStanding, label: "骨骼动画" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-250 ease-in-out",
        collapsed ? "w-[68px]" : "w-[260px]",
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-sidebar-border px-5 py-5",
        collapsed ? "justify-center px-0" : "gap-3",
      )}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25">
          <Sparkles className="h-[18px] w-[18px] text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-[15px] font-semibold tracking-tight text-foreground whitespace-nowrap">
              AIGC Playground
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              AI 产品交互模式全景
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-1">
            {!collapsed && (
              <p className="mb-1 mt-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 first:mt-1">
                {group.title}
              </p>
            )}
            {collapsed && <div className="my-2 mx-3 h-px bg-sidebar-border" />}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg transition-all duration-150",
                      collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                    )}
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] shrink-0 transition-colors",
                        isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    {!collapsed && <span className="truncate text-[14px]">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-3">
        {!collapsed && (
          <p className="mb-2 px-2 text-[11px] tracking-wide text-muted-foreground/60">
            Next.js 16 · Tailwind v4 · shadcn/ui
          </p>
        )}
        <button
          onClick={toggle}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-foreground"
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px]" />
              <span>收起</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
