"use client";

import { useRef, useEffect } from "react";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

/** Markdown 渲染 — streaming 时不注入 code-header 避免抖动 */
export function MarkdownContent({ content, streaming }: { content: string; streaming?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html = marked.parse(content) as string;

  useEffect(() => {
    if (streaming || !containerRef.current) return;
    const pres = containerRef.current.querySelectorAll("pre");
    pres.forEach((pre) => {
      if (pre.querySelector(".code-header")) return;
      const codeEl = pre.querySelector("code");
      if (!codeEl) return;
      const langClass = Array.from(codeEl.classList).find((c) => c.startsWith("language-"));
      const lang = langClass ? langClass.replace("language-", "") : "code";
      const code = codeEl.textContent || "";
      const header = document.createElement("div");
      header.className = "code-header";
      header.innerHTML = `
        <span class="code-lang">${lang}</span>
        <button class="code-copy-btn" data-code="${encodeURIComponent(code)}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>复制</span>
        </button>`;
      pre.insertBefore(header, pre.firstChild);
      pre.style.paddingTop = "0";
      const btn = header.querySelector(".code-copy-btn") as HTMLButtonElement;
      btn?.addEventListener("click", async () => {
        const codeText = decodeURIComponent(btn.dataset.code || "");
        await navigator.clipboard.writeText(codeText);
        const span = btn.querySelector("span");
        if (span) {
          span.textContent = "已复制";
          btn.classList.add("copied");
          setTimeout(() => { span.textContent = "复制"; btn.classList.remove("copied"); }, 2000);
        }
      });
    });
  }, [html, streaming]);

  return <div ref={containerRef} className="markdown-body min-w-0" dangerouslySetInnerHTML={{ __html: html }} />;
}
