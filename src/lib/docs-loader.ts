// Server-only docs loader.
//
// Reads operator-authored public-safe Markdown from
// `src/content/public-beta/` at BUILD TIME and converts it to HTML
// via `marked`. The content is mirrored from
// `deopt-v2-backend/docs/public-beta/` in the
// FRONTEND-INTEGRATED-DOCS-AND-FEEDBACK milestone so the frontend is
// self-contained on Vercel/Netlify (no runtime path traversal).
//
// Posture: operator-controlled content only. NO private docs, NO
// operator runbooks, NO bearer-token examples, NO mainnet RPC URLs,
// NO `.env` snippets, NO admin endpoints documented here.
//
// The MD source files are scanned at build time by the e2e suite +
// the milestone's sensitive-string validation — never trust user
// input through this loader; only the bundled MD files are rendered.

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export interface DocPage {
  /** Slug used in /docs/[slug]. */
  slug: string;
  /** Visible title (first `# Heading` from the doc). */
  title: string;
  /** Server-rendered HTML body (post-`marked`). */
  html: string;
  /** Short description for the docs index. */
  description: string;
  /** Source MD filename (for cross-reference + test stamping). */
  sourceFile: string;
}

/**
 * Map from `/docs/<slug>` to source MD file in `src/content/public-beta/`.
 * Adding a slug here is the only step needed to wire a new doc — the
 * dynamic `/docs/[slug]` route picks it up automatically.
 */
const SLUG_TO_FILE: Record<string, string> = {
  quickstart: "BASE_SEPOLIA_QUICKSTART.md",
  "testing-guide": "USER_TESTING_GUIDE.md",
  limitations: "KNOWN_LIMITATIONS_AND_RISKS.md",
  faq: "FAQ.md",
};

const DESCRIPTIONS: Record<string, string> = {
  quickstart:
    "5-minute Base Sepolia setup — wallet, testnet ETH, mUSDC, sample trade.",
  "testing-guide":
    "End-to-end testnet trade walkthrough with expected outcomes for each step.",
  limitations:
    "Known limitations and risks — testnet, oracle, addresses, indexer, market-making, regulatory.",
  faq: "Frequently asked questions about the public testnet beta.",
};

function publicBetaDir(): string {
  return path.join(process.cwd(), "src", "content", "public-beta");
}

function readMd(filename: string): string {
  const full = path.join(publicBetaDir(), filename);
  return fs.readFileSync(full, "utf8");
}

/**
 * Extract the first H1 (`# Title`) from a markdown source. Falls back
 * to the slug name if no H1 found.
 */
function extractTitle(md: string, fallback: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim().replace(/\s*\(Public Beta\)\s*$/i, "") : fallback;
}

/**
 * Convert MD → HTML at build time. `marked` is synchronous in v18
 * when no async extensions are loaded. We force-cast to string since
 * `parse()` may otherwise be typed as `string | Promise<string>`.
 *
 * The output is rendered inside `<div className="prose-deopt">` which
 * gives it the DeOpt dark/emerald typography rules from globals.css.
 */
function renderMd(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true });
  return typeof html === "string" ? html : "";
}

/** Returns the list of slugs registered with the docs loader. */
export function allDocSlugs(): string[] {
  return Object.keys(SLUG_TO_FILE);
}

/** Load and render a single doc by slug. Throws if the slug is unknown. */
export function loadDoc(slug: string): DocPage {
  const filename = SLUG_TO_FILE[slug];
  if (!filename) {
    throw new Error(`Unknown docs slug: ${slug}`);
  }
  const md = readMd(filename);
  const title = extractTitle(md, slug);
  const html = renderMd(md);
  return {
    slug,
    title,
    html,
    description: DESCRIPTIONS[slug] ?? "",
    sourceFile: filename,
  };
}

/** Lightweight metadata for the docs index — does NOT render HTML. */
export interface DocIndexEntry {
  slug: string;
  title: string;
  description: string;
}

export function allDocIndexEntries(): DocIndexEntry[] {
  return allDocSlugs().map((slug) => {
    const filename = SLUG_TO_FILE[slug];
    const md = readMd(filename);
    return {
      slug,
      title: extractTitle(md, slug),
      description: DESCRIPTIONS[slug] ?? "",
    };
  });
}
