import { PlusIcon } from "@phosphor-icons/react/ssr";

import { Band } from "@/components/band";
import { FAQ } from "@/data/site";

import { SectionHeading } from "./section-heading";

// Plain <details>, so every answer is in the static HTML a crawler reads.
export function Faq() {
  return (
    <Band tone="paper">
      <div className="grid gap-12 md:grid-cols-[2fr_3fr]">
        <SectionHeading id="faq" title="Questions" lede="Cost, access, and what it never does" />
        <div className="flex flex-col">
          {FAQ.map((item) => (
            <details key={item.question} className="group border-t last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-5 text-subtitle font-normal outline-none hover:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/60 active:text-muted-foreground [&::-webkit-details-marker]:hidden">
                {item.question}
                <PlusIcon
                  weight="bold"
                  aria-hidden
                  className="size-5 shrink-0 transition-transform group-open:rotate-45"
                />
              </summary>
              <p className="pb-6 text-small text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Band>
  );
}
