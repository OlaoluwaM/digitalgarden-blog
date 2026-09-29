// /robots.txt: lets every crawler in and names the sitemap index, which
// @astrojs/sitemap writes to /sitemap-index.xml.
import type { APIRoute } from "astro";
import { site } from "../lib/site";

export const GET = (() =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${new URL("/sitemap-index.xml", site.url).href}`,
      "",
    ].join("\n")
  )) satisfies APIRoute;
