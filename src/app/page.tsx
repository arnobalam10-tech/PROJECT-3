import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1">
      <section className="flex min-h-[82vh] flex-col justify-between bg-ink px-6 py-8 text-surface md:px-12 md:py-10">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.15em] text-surface/70">
          <span>Relay</span>
          <span>CSE226 — Foundations of Vibe Coding</span>
        </div>

        <div>
          <div className="mb-6 h-1 w-20 bg-accent" />
          <h1 className="headline text-surface text-[16vw] md:text-[11rem]">relay</h1>
          <p className="mt-6 max-w-xl text-lg text-surface/80">
            The digital version of a paper memo routed for signatures. Draft a memo, send it
            through the people who need to act on it, and track every decision from first draft
            to final sign-off — no fixed chain of command required.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/login"
            className="bg-surface px-6 py-3 text-sm font-medium uppercase tracking-wide text-ink"
          >
            sign in
          </Link>
          <Link
            href="/signup"
            className="border border-surface px-6 py-3 text-sm font-medium uppercase tracking-wide text-surface"
          >
            create your organization
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 border-t-[3px] border-ink md:grid-cols-3 md:divide-x md:divide-rule">
        <div className="border-b border-rule px-6 py-10 md:border-b-0 md:px-10 md:py-14">
          <p className="mb-3 text-xs uppercase tracking-[0.15em] text-muted">01 / create</p>
          <h2 className="headline mb-4 text-3xl">draft it</h2>
          <p className="text-body">
            Write the memo, attach whatever supporting files it needs, and pick who has to weigh
            in — an ordered starting chain, or one of your org&apos;s reusable templates.
          </p>
        </div>
        <div className="border-b border-rule px-6 py-10 md:border-b-0 md:px-10 md:py-14">
          <p className="mb-3 text-xs uppercase tracking-[0.15em] text-muted">02 / route</p>
          <h2 className="headline mb-4 text-3xl">route it</h2>
          <p className="mb-4 text-body">
            A suggested chain, not a locked contract. Whoever holds the memo decides what happens
            next — forward it on, reroute it to someone better placed, or send it back for
            changes.
          </p>
          <p className="font-mono text-sm text-muted">
            Employee → Dept Head → Finance → Director
          </p>
        </div>
        <div className="px-6 py-10 md:px-10 md:py-14">
          <p className="mb-3 text-xs uppercase tracking-[0.15em] text-muted">03 / resolve</p>
          <h2 className="headline mb-4 text-3xl">resolve it</h2>
          <p className="text-body">
            Approve, reject, or request changes — every decision is timestamped, commented, and
            kept, so the full history of who did what is never in question.
          </p>
        </div>
      </section>

      <section className="border-t border-ink px-6 py-10 md:px-12">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <p className="headline text-2xl md:text-3xl">ready when you are.</p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="bg-ink px-6 py-3 text-sm font-medium uppercase tracking-wide text-surface"
            >
              create your organization
            </Link>
            <Link
              href="/login"
              className="border border-ink px-6 py-3 text-sm font-medium uppercase tracking-wide text-ink"
            >
              sign in
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
