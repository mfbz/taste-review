import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";

import { Band } from "@/components/band";
import { Button } from "@/components/ui/button";
import { SETUP, TASTE_KEYS_URL, WORKFLOW_YAML } from "@/data/site";

import { SectionHeading } from "./section-heading";

export function Setup() {
  return (
    <Band tone="ink">
      <SectionHeading
        id="setup"
        title="Set up in five minutes"
        lede="A key, a workflow file, and a comment"
      />
      <ol className="mt-12 grid gap-6 md:grid-cols-3">
        {SETUP.map((step, index) => (
          <li key={step.title} className="flex flex-col gap-2 border-t pt-6">
            <span className="font-mono text-label text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-subtitle font-normal">{step.title}</h3>
            <p className="text-small text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
      <Button asChild variant="outline" className="mt-8">
        <a href={TASTE_KEYS_URL}>
          Create a Taste Engine key
          <ArrowUpRightIcon weight="bold" aria-hidden />
        </a>
      </Button>
      <figure className="mt-12 overflow-hidden rounded-lg border bg-void">
        <figcaption className="border-b px-4 py-3 font-mono text-label text-muted-foreground">
          .github/workflows/taste-review.yml
        </figcaption>
        <pre className="overflow-x-auto p-4 font-mono text-label leading-relaxed">
          <code>{WORKFLOW_YAML}</code>
        </pre>
      </figure>
    </Band>
  );
}
