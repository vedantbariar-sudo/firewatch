import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title: string;
  icon?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Single bordered block used by every dashboard panel. */
export function Panel({
  title,
  icon,
  right,
  children,
  className,
  contentClassName,
}: PanelProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card/50",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          {icon}
          {title}
        </h2>
        {right}
      </header>
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}
