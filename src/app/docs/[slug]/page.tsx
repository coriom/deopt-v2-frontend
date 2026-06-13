import Link from "next/link";
import { notFound } from "next/navigation";
import { allDocSlugs, loadDoc } from "@/lib/docs-loader";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return allDocSlugs().map((slug) => ({ slug }));
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  if (!allDocSlugs().includes(slug)) {
    notFound();
  }
  const doc = loadDoc(slug);
  return (
    <article
      data-testid={`docs-content-${doc.slug}`}
      data-source-file={doc.sourceFile}
      className="flex flex-col gap-4"
    >
      <nav className="text-[11px]">
        <Link href="/docs" className="text-emerald-300 hover:text-emerald-200">
          ← Back to docs
        </Link>
      </nav>

      <div
        data-testid={`docs-prose-${doc.slug}`}
        className="prose-deopt rounded-lg border border-zinc-800 bg-zinc-950 p-6"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />

      <footer className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[11px] text-zinc-400">
        <span>
          Source:{" "}
          <code className="rounded border border-zinc-800 bg-black/40 px-1 py-0.5 text-emerald-200">
            {doc.sourceFile}
          </code>{" "}
          (mirrored from <code>deopt-v2-backend/docs/public-beta/</code> for
          static hosting; operator-authored, public-safe content only).
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/feedback"
            data-testid={`docs-feedback-cta-${doc.slug}`}
            className="rounded border border-emerald-500/50 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
          >
            Report a bug
          </Link>
          <a
            href="https://discord.gg/zaEMvWuxu"
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`docs-discord-cta-${doc.slug}`}
            className="rounded border border-emerald-500/50 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
          >
            Open Discord
          </a>
        </div>
      </footer>
    </article>
  );
}
