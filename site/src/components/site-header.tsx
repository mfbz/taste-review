import { GithubLogoIcon } from "@phosphor-icons/react/ssr";

import { CANVAS } from "@/components/band";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { REPO_URL } from "@/data/site";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#setup", label: "Setup" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  return (
    <header data-band="paper" className="sticky top-0 z-10 border-b">
      <div className={cn(CANVAS, "flex h-16 items-center justify-between gap-4")}>
        <a
          href="#top"
          className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <Wordmark />
        </a>
        <nav aria-label="Sections" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-sm text-small font-normal text-foreground outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/60 active:text-muted-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Button asChild size="sm">
          <a href={REPO_URL}>
            <GithubLogoIcon weight="fill" aria-hidden />
            <span className="sr-only sm:not-sr-only">View on</span> GitHub
          </a>
        </Button>
      </div>
    </header>
  );
}
