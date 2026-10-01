import { Band } from "@/components/band";
import { STEPS } from "@/data/site";

import { SectionHeading } from "./section-heading";

export function HowItWorks() {
  return (
    <Band tone="paper">
      <div className="grid gap-12 md:grid-cols-[2fr_3fr]">
        <SectionHeading
          id="how-it-works"
          title="Ask, and the preview is judged"
          lede="One command on the pull request, one comment back"
        />
        <ol className="flex flex-col">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-[3rem_1fr] gap-4 border-t py-6 last:border-b"
            >
              <span className="font-mono text-label text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-subtitle font-normal">{step.title}</h3>
                <p className="text-small text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Band>
  );
}
