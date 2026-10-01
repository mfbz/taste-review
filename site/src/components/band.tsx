import { cn } from "@/lib/utils";

type BandProps = React.ComponentProps<"section"> & {
  tone: "paper" | "ink" | "void";
};

export const CANVAS = "mx-auto w-full max-w-canvas px-5 sm:px-8";

// A full-width band that re-themes everything inside it, the way the page
// alternates paper and ink sections.
export function Band({ tone, className, children, ...props }: BandProps) {
  return (
    <section data-band={tone} className={cn("py-20 sm:py-28", className)} {...props}>
      <div className={CANVAS}>{children}</div>
    </section>
  );
}
