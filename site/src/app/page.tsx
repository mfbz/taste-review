import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import { Audiences } from "./_components/audiences";
import { Extraction } from "./_components/extraction";
import { Faq } from "./_components/faq";
import { Hero } from "./_components/hero";
import { HowItWorks } from "./_components/how-it-works";
import { Setup } from "./_components/setup";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Audiences />
        <Extraction />
        <Setup />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
