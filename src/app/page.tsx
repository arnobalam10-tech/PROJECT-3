import Link from "next/link";
import { ArrowRight, GitBranch, History, Building2, BellRing } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrowserFrame } from "./browser-frame";
import { DashboardMockup } from "./dashboard-mockup";
import { MemoDetailMockup } from "./memo-detail-mockup";

const STEPS = [
  {
    n: "01",
    title: "Draft",
    body: "Write the memo, attach what it needs, and choose who has to weigh in — a custom chain, or a reusable template.",
  },
  {
    n: "02",
    title: "Route",
    body: "Every step is a real decision, not a rubber stamp. Whoever holds it can forward, reroute, or send it back.",
  },
  {
    n: "03",
    title: "Resolve",
    body: "Approve, reject, or request changes. Every decision is timestamped and kept — nothing is ever in question.",
  },
];

const FEATURES = [
  {
    icon: GitBranch,
    title: "Flexible routing",
    body: "Start with a suggested chain and let it adapt — forward to someone new or reroute mid-flight without breaking the record.",
  },
  {
    icon: History,
    title: "Full audit trail",
    body: "Every approval, rejection, comment, and delegation is logged and immutable — nothing quietly disappears.",
  },
  {
    icon: Building2,
    title: "Multi-tenant by design",
    body: "Every organization's data is isolated at the database level, enforced on every query — not just hidden in the UI.",
  },
  {
    icon: BellRing,
    title: "Real-time notifications",
    body: "In-app and email alerts the moment a memo needs you, was approved, or came back for changes.",
  },
];

export default function Home() {
  return (
    <div className="flex-1">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <span className="shrink-0 text-lg font-semibold tracking-tight">Relay</span>
          <nav className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "whitespace-nowrap")}>
              <span className="sm:hidden">Sign up</span>
              <span className="hidden sm:inline">Create your organization</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Memos that route themselves through your org — not a fixed chain of command.
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Relay is the digital version of a paper memo routed for signatures. Draft it, send
              it to the people who need to act, and track every decision from first draft to
              final sign-off.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Create your organization
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Sign in
              </Link>
            </div>
          </div>
          <BrowserFrame url="relay.app/dashboard" className="lg:-mr-4">
            <DashboardMockup />
          </BrowserFrame>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-secondary/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              A memo doesn&apos;t follow a rigid org chart — it follows whoever holds it right now.
            </p>
          </div>

          <div className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            <div className="absolute top-6 right-0 left-0 hidden h-px bg-border md:block" />
            {STEPS.map((step) => (
              <div key={step.n} className="relative flex flex-col items-start">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {step.n}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-3 rounded-2xl border border-border bg-background px-6 py-5 text-center text-sm font-medium">
            {["Employee", "Dept Head", "Finance", "Director"].map((role, i, arr) => (
              <span key={role} className="flex items-center gap-2">
                <span className="rounded-full bg-secondary px-3 py-1.5">{role}</span>
                {i < arr.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Built for how approvals actually work</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Second mockup: acting on a memo day to day */}
      <section className="border-t border-border bg-secondary/40 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <BrowserFrame url="relay.app/memos/MEMO-2026-00412" className="order-2 lg:order-1">
              <MemoDetailMockup />
            </BrowserFrame>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                What it looks like when it lands on your desk.
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">
                See exactly where a memo has been, who&apos;s next, and everything you need to
                decide — the full body, attachments, and comment history — before you approve,
                forward, or send it back.
              </p>
              <Link href="/signup" className={cn(buttonVariants({ variant: "outline" }), "mt-6")}>
                Try it yourself
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6 rounded-3xl bg-primary px-8 py-14 text-center text-primary-foreground sm:px-16">
            <h2 className="text-3xl font-semibold tracking-tight text-balance">
              Ready to route your first memo?
            </h2>
            <p className="max-w-md text-primary-foreground/80">
              Set up your organization in under a minute — no credit card, no fixed chain of
              command to configure first.
            </p>
            <Link href="/signup" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Create your organization
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <span>© 2026 Relay</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Create an organization
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
