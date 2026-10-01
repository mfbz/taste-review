import type { MetadataRoute } from "next";

import { SITE_URL } from "@/data/site";

export const dynamic = "force-static";

// One page. No lastModified: a static build only knows its deploy time, which is not when the page changed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/` }];
}
