export function generateStaticParams() {
  return [
    { id: "agent-1" },
    { id: "agent-2" },
    { id: "agent-3" },
    { id: "agent-4" },
  ];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
