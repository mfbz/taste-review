import {
  CaretRightIcon,
  GithubLogoIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/badge";
import { EXAMPLE_REVIEW } from "@/data/example-review";
import { cn } from "@/lib/utils";

// A drop smaller than this is the engine's own noise, not a change worth flagging.
const MARGIN = 0.05;

function formatScore(score: number): string {
  return score.toFixed(2);
}

function Change({ production, preview }: { production: number; preview: number }) {
  const delta = preview - production;
  if (Math.abs(delta) < MARGIN) {
    return <span className="text-muted-foreground">steady</span>;
  }
  const Icon = delta < 0 ? TrendDownIcon : TrendUpIcon;
  return (
    <span className={cn("inline-flex items-center gap-1", delta < 0 ? "text-drop" : "text-rise")}>
      <Icon weight="bold" aria-hidden className="size-4" />
      {delta < 0 ? "dropped" : "rose"} {formatScore(Math.abs(delta))}
    </span>
  );
}

export function PrComment({ className }: { className?: string }) {
  const review = EXAMPLE_REVIEW;
  return (
    <article
      data-band="paper"
      aria-label="Example pull request comment"
      className={cn(
        "overflow-hidden rounded-lg border bg-card text-left text-card-foreground",
        className,
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b bg-secondary px-4 py-3 text-small">
        <GithubLogoIcon weight="fill" aria-hidden className="size-5" />
        <span className="font-medium">github-actions</span>
        <Badge variant="outline" className="font-mono text-tag">
          bot
        </Badge>
        <span className="text-muted-foreground">commented</span>
      </header>

      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-subtitle font-normal">Taste review</h3>
          <p className="font-mono text-label text-muted-foreground">
            {review.pages.length} pages · checked at {review.sha}
          </p>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-md border-collapse text-small">
            <thead>
              <tr className="border-b text-left font-mono text-label text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-normal">
                  Page
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Production
                </th>
                <th scope="col" className="py-2 pr-4 font-normal">
                  Preview
                </th>
                <th scope="col" className="py-2 font-normal">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {review.pages.map((page) => (
                <tr key={page.path} className="border-b last:border-b-0">
                  <th
                    scope="row"
                    className="py-2.5 pr-4 text-left font-mono text-label font-normal"
                  >
                    {page.path}
                  </th>
                  <td className="py-2.5 pr-4 tabular-nums">{formatScore(page.production)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{formatScore(page.preview)}</td>
                  <td className="py-2.5 tabular-nums">
                    <Change production={page.production} preview={page.preview} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-small font-medium">/pricing · worst first</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-small text-muted-foreground marker:font-mono marker:text-label">
            {review.recommendations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </div>

        <details className="group rounded-md border bg-secondary">
          <summary className="active:bg-accent[&::-webkit-details-marker]:hidden flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2.5 font-mono text-label outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/60">
            <CaretRightIcon
              weight="bold"
              aria-hidden
              className="size-3.5 transition-transform group-open:rotate-90"
            />
            Fix with your agent
          </summary>
          <pre className="overflow-x-auto border-t px-3 py-3 font-mono text-tag leading-relaxed">
            {JSON.stringify(review.fixes, null, 2)}
          </pre>
        </details>
      </div>
    </article>
  );
}
