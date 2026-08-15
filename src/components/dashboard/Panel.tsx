import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Single bordered block used by every dashboard panel. */
export function Panel({
  title,
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
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {right}
        </header>
      )}
      <div className={cn("px-4 pb-4", contentClassName)}>{children}</div>
    </section>
  );
}
