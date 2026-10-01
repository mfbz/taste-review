import { Band } from "@/components/band";
import { EXAMPLE_EXTRACTION } from "@/data/example-review";

import { SectionHeading } from "./section-heading";

export function Extraction() {
  const extraction = EXAMPLE_EXTRACTION;
  return (
    <Band tone="paper">
      <div className="grid gap-12 md:grid-cols-[2fr_3fr]">
        <SectionHeading
          title="Your brand, read from your live site"
          lede="Production is the reference, so the bar moves when you ship"
        />
        <figure className="flex flex-col gap-8">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {extraction.colors.map((color) => (
              <li key={color.hex} className="flex flex-col gap-2">
                <span
                  aria-hidden
                  className="block aspect-square rounded-md border"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-small font-normal">{color.name}</span>
                <span className="font-mono text-tag text-muted-foreground">{color.hex}</span>
                <span className="text-small text-muted-foreground">{color.role}</span>
              </li>
            ))}
          </ul>
          <table className="w-full border-collapse text-small">
            <tbody>
              {extraction.type.map((row) => (
                <tr key={row.role} className="border-t last:border-b">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-left font-mono text-label font-normal text-muted-foreground"
                  >
                    {row.role}
                  </th>
                  <td className="py-3 pr-4">{row.family}</td>
                  <td className="py-3 text-right font-mono text-label text-muted-foreground">
                    {row.spec}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="font-mono text-tag text-muted-foreground">
            Part of what the Taste Engine extracted from {extraction.source}
          </figcaption>
        </figure>
      </div>
    </Band>
  );
}
