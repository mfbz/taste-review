import { cn } from "@/lib/utils";

// The product's name is the command that runs it.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("font-mono text-label font-medium tracking-tight whitespace-nowrap", className)}
    >
      <span className="text-muted-foreground">/</span>taste review
    </span>
  );
}
