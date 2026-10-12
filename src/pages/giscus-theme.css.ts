// /giscus-theme.css: the giscus comments widget's theme (ADR 0008), built
// from tokens.css at build time so it cannot drift from the site. giscus.app
// loads it cross-origin; vercel.json allows that.
import type { APIRoute } from "astro";
import { giscusThemeCss } from "../lib/giscus";
import { lucideFont, reactionIconsFont } from "../lib/reaction-icons";
import { parseTokens } from "../lib/tokens";
import tokensSource from "../styles/tokens.css?raw";

export const GET = (() =>
  new Response(
    giscusThemeCss(parseTokens(tokensSource), reactionIconsFont(lucideFont())),
    { headers: { "Content-Type": "text/css; charset=utf-8" } }
  )) satisfies APIRoute;
