"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function HoverCopyButton({ text, position }: { text: string; position: "left" | "right" }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handleCopy}
      className={`absolute -top-3 ${position === "right" ? "-right-3" : "-left-3"
        } flex h-7 w-7 scale-0 items-center justify-center rounded-lg border border-border bg-card shadow-lg shadow-black/20 transition-all duration-200 group-hover:scale-100 ${copied ? "border-emerald-500/40 text-emerald-400" : "text-muted-foreground hover:text-foreground"
        }`}
      title="复制"
    >
      <span className={`transition-transform duration-200 ${copied ? "scale-110" : ""}`}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}
