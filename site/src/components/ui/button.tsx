import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Slot } from "radix-ui";

// Mono label, 1px outline, and a hover that inverts the fill: the reference
// brand's button, which carries no shadow and no colour of its own.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-sm border font-mono text-label font-normal whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/60 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:bg-transparent hover:text-foreground active:bg-muted",
        outline:
          "border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background active:bg-foreground/80 active:text-background",
        ghost:
          "border-transparent bg-transparent text-foreground hover:bg-muted active:bg-secondary",
        link: "h-auto border-transparent px-0 text-link underline-offset-4 hover:underline active:opacity-80",
      },
      size: {
        default: "h-9 gap-2 px-6",
        sm: "h-8 gap-1.5 px-4",
        lg: "h-11 gap-2 px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
