import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  id?: string;
  title: string;
  lede: string;
  className?: string;
};

export function SectionHeading({ id, title, lede, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex max-w-md flex-col gap-3", className)}>
      <h2 id={id} className="scroll-mt-24 text-title font-normal">
        {title}
      </h2>
      <p className="text-body text-muted-foreground">{lede}</p>
    </div>
  );
}
