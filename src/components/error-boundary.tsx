"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">页面渲染出错</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {this.state.error?.message || "发生了未知错误"}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/80"
          >
            <RotateCcw className="h-4 w-4" />
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
