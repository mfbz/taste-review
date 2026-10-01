import { Band } from "@/components/band";
import { Separator } from "@/components/ui/separator";
import { EXAMPLE_REVIEW } from "@/data/example-review";
import { AUDIENCES } from "@/data/site";

import { SectionHeading } from "./section-heading";

function ScoreBars() {
  return (
    <dl className="flex w-full max-w-xs flex-col gap-4">
      {EXAMPLE_REVIEW.pages.map((page) => (
        <div key={page.path} className="flex flex-col gap-1.5">
          <dt className="font-mono text-label">{page.path}</dt>
          <dd className="flex flex-col gap-1">
            <span className="sr-only">
              Production {page.production}, preview {page.preview}
            </span>
            <span
              aria-hidden
              className="block h-1.5 rounded-full bg-muted-foreground"
              style={{ width: `${page.production * 100}%` }}
            />
            <span
              aria-hidden
              className="block h-1.5 rounded-full bg-foreground"
              style={{ width: `${page.preview * 100}%` }}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FixSnippet() {
  const [fix] = EXAMPLE_REVIEW.fixes;
  return (
    <pre className="w-full max-w-xs overflow-x-auto rounded-md border bg-background p-4 font-mono text-tag leading-relaxed">
      {JSON.stringify(fix, null, 2)}
    </pre>
  );
}

const VISUALS = [ScoreBars, FixSnippet];

export function Audiences() {
  return (
    <Band tone="void">
      <SectionHeading
        title="Read by people and by agents"
        lede="The same verdict, in the form each of them acts on"
      />
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {AUDIENCES.map((audience, index) => {
          const Visual = VISUALS[index];
          return (
            <div
              key={audience.title}
              className="flex min-w-0 flex-col rounded-lg border bg-card p-6 sm:p-10"
            >
              <div className="flex min-h-48 items-center justify-center">
                <Visual />
              </div>
              <Separator className="my-8" />
              <h3 className="text-subtitle font-normal">{audience.title}</h3>
              <p className="mt-3 text-small text-muted-foreground">{audience.body}</p>
            </div>
          );
        })}
      </div>
    </Band>
  );
}
