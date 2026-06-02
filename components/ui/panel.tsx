import { cn } from "@/lib/utils";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return <section className={cn("rounded-md border border-border bg-white shadow-subtle", className)}>{children}</section>;
}

export function PanelHeader({ children, className }: PanelProps) {
  return <div className={cn("border-b border-border px-4 py-3", className)}>{children}</div>;
}

export function PanelBody({ children, className }: PanelProps) {
  return <div className={cn("p-4", className)}>{children}</div>;
}
