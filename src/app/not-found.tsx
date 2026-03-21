import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-6xl">🔍</div>
      <div>
        <p className="text-lg font-medium text-foreground">页面不存在</p>
        <p className="mt-1 text-sm text-muted-foreground">你访问的页面可能已被移除或地址有误</p>
      </div>
      <Link
        href="/chat"
        className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary/80"
      >
        返回首页
      </Link>
    </div>
  );
}
