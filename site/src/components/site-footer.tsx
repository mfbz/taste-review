import { CANVAS } from "@/components/band";
import { Wordmark } from "@/components/wordmark";
import { REPO_URL, TASTE_DOCS_URL } from "@/data/site";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: REPO_URL, label: "GitHub" },
  { href: `${REPO_URL}/blob/main/LICENSE`, label: "MIT license" },
  { href: TASTE_DOCS_URL, label: "Taste Engine docs" },
] as const;

export function SiteFooter() {
  return (
    <footer data-band="ink" className="border-t py-12">
      <div
        className={cn(CANVAS, "flex flex-col gap-8 md:flex-row md:items-end md:justify-between")}
      >
        <div className="flex flex-col gap-3">
          <Wordmark />
          <p className="max-w-md text-small text-muted-foreground">
            Built on the Taste Engine API. An independent project, not affiliated with Taste Labs.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="rounded-sm font-mono text-label text-foreground outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/60 active:text-muted-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
