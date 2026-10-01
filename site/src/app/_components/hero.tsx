import { ArrowDownIcon, GithubLogoIcon } from "@phosphor-icons/react/ssr";

import { Band } from "@/components/band";
import { Button } from "@/components/ui/button";
import { REPO_URL } from "@/data/site";

import { PrComment } from "./pr-comment";

export function Hero() {
  return (
    <Band tone="ink" id="top" className="pt-20 pb-24 sm:pt-28">
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="max-w-5xl text-display font-normal text-balance">
          <span className="block text-muted-foreground">Brand review on every pull request</span>
          <span className="block">scored against your live site</span>
        </h1>
        <p className="max-w-xl text-body text-muted-foreground">
          Comment /taste review and your Vercel preview is judged against your production brand,
          with the fixes your coding agent can apply.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <a href="#setup">
              Set up in five minutes
              <ArrowDownIcon weight="bold" aria-hidden />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={REPO_URL}>
              <GithubLogoIcon weight="fill" aria-hidden />
              View on GitHub
            </a>
          </Button>
        </div>
      </div>
      <PrComment className="mx-auto mt-16 max-w-3xl" />
      <p className="mt-4 text-center font-mono text-tag text-muted-foreground">
        An example comment. The scores are illustrative.
      </p>
    </Band>
  );
}
