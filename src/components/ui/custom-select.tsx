"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, onChange, options, placeholder = "请选择", className }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClickOutside]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-2 transition-colors",
          "bg-white/[0.05] border border-white/[0.1] text-foreground",
          "hover:bg-white/[0.08] focus:outline-none focus:border-indigo-400/50",
          open && "border-indigo-400/50"
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected?.label || placeholder}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-white/[0.1] bg-[oklch(0.18_0.02_260)] shadow-xl">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors",
                "hover:bg-white/[0.08]",
                opt.value === value ? "text-indigo-300" : "text-foreground"
              )}
            >
              <Check className={cn("w-3 h-3 shrink-0", opt.value === value ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
