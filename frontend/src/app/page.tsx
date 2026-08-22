import Link from "next/link";
import {
  MessageSquareWarning,
  Link2,
  BriefcaseBusiness,
  ShieldCheck,
  Lightbulb,
  Hand,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { AttackSimulator } from "@/components/AttackSimulator";
import { SenderLookup } from "@/components/SenderLookup";
import { StatsBar } from "@/components/StatsBar";

export default function LandingPage() {
  return (
    <>
      {/* ──────────────── Hero ──────────────── */}
      <section className="relative overflow-hidden bg-ink-950">
        <div className="absolute inset-0 bg-hero-grid bg-[size:28px_28px] opacity-40" />
        <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-brand-600/20 blur-[120px]" />
        <div className="container-wide relative grid gap-14 py-20 lg:grid-cols-12 lg:py-28">
          <div className="lg:col-span-7">
            <span className="eyebrow">Public Cyber Safety Platform</span>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
              Know what a suspicious message{" "}
              <span className="text-brand-400">actually</span> means —
              before you act on it.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-300">
              SuSagi analyses suspicious messages, links, and job offers and
              returns a clear risk level, the specific red flags that triggered
              it, and the exact next steps you should take. No jargon, no black
              box, no false certainty.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/analyze" className="btn-brand px-5 py-3">
                Analyze content <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/about" className="btn-outline px-5 py-3">
                How it works
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-300">
              <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-400" /> Evidence-based reasoning</li>
              <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-400" /> No login required</li>
              <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-brand-400" /> Works on any device</li>
            </ul>
          </div>

          {/* Preview card */}
          <div className="lg:col-span-5">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* ──────────────── Stats ──────────────── */}
      <StatsBar />

      {/* ──────────────── Check before you answer ──────────────── */}
      <section className="bg-ink-950 py-16">
        <div className="container-wide max-w-3xl">
          <span className="eyebrow">Before you even open it</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">
            Most checkers only work after the fact. This one doesn&apos;t have to.
          </h2>
          <p className="mt-3 text-ink-300">
            If you&apos;ve tagged a sender before, check their history first —
            before you open, reply, or act on whatever they just sent.
          </p>
          <div className="mt-6">
            <SenderLookup />
          </div>
        </div>
      </section>

      {/* ──────────────── Attack Simulator ──────────────── */}
      <section className="bg-black/20 py-16">
        <div className="container-wide max-w-3xl">
          <span className="eyebrow">See it work, instantly</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-ink-50 sm:text-3xl">
            No content to paste? Simulate a real attack.
          </h2>
          <p className="mt-3 text-ink-300">
            These aren&apos;t canned answers — each scenario runs through the
            exact same detection pipeline as anything you&apos;d paste yourself.
          </p>
          <div className="mt-6">
            <AttackSimulator />
          </div>
        </div>
      </section>

      {/* ──────────────── 3 Modes ──────────────── */}
      <section className="bg-ink-950 py-20">
        <div className="container-wide">
          <div className="max-w-2xl">
            <span className="eyebrow">Three analysis modes</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              One platform for the content most often weaponised against people.
            </h2>
            <p className="mt-4 text-ink-300">
              Each mode is tuned to the red flags that matter for that kind of
              content — so the reasoning you see is specific to what you pasted.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <ModeCard
              icon={<MessageSquareWarning className="h-5 w-5" />}
              title="Message Check"
              lede="Phishing texts, OTP scams, bank impersonation, reward bait."
              bullets={[
                "Urgency and pressure wording",
                "Requests for OTPs, PINs, or passwords",
                "Impersonation of trusted institutions",
              ]}
            />
            <ModeCard
              icon={<Link2 className="h-5 w-5" />}
              title="Link Check"
              lede="Suspicious domains, shorteners, and brand lookalikes."
              bullets={[
                "Typosquatted brand domains",
                "Abuse-prone TLDs and shorteners",
                "Login-style paths on disposable hosts",
              ]}
            />
            <ModeCard
              icon={<BriefcaseBusiness className="h-5 w-5" />}
              title="Job Offer Check"
              lede="Fake recruiters, advance-fee jobs, mule-style roles."
              bullets={[
                "Upfront fees and deposits",
                "Rushed hiring without interviews",
                "Premature requests for ID or bank details",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ──────────────── Why explanations matter ──────────────── */}
      <section className="bg-black/20 py-20">
        <div className="container-wide grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="eyebrow">Explainable by design</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50 sm:text-4xl">
              A verdict is only useful if you understand why.
            </h2>
            <p className="mt-4 text-ink-300">
              Generic “this looks suspicious” warnings don’t help anyone. Every
              SuSagi result walks you through six layers of reasoning, each
              grounded in the specific wording, domain pattern, or recruiter
              signal that triggered it.
            </p>
            <ol className="relative mt-8 space-y-1">
              {[
                ["Risk Level", "Safe, Low Risk, Suspicious, Likely Scam, or High Risk."],
                ["Threat Category", "Phishing, OTP scam, fake job offer, and more."],
                ["Why It Was Flagged", "The exact patterns the analyser saw."],
                ["Why You Should Not Proceed", "What could realistically happen if you do."],
                ["Recommended Safe Action", "Concrete next steps, tailored to the threat."],
                ["Block / Report Guidance", "Platform-agnostic steps to shut it down."],
              ].map(([h, d], i, arr) => (
                <li key={h} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < arr.length - 1 && (
                    <span className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-ink-800" />
                  )}
                  <span className="relative z-10 mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-1">
                    <span className="font-semibold text-ink-50">{h}.</span>{" "}
                    <span className="text-ink-400">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <ExampleScenarios />
        </div>
      </section>

      {/* ──────────────── Action + response ──────────────── */}
      <section className="bg-ink-950 py-20">
        <div className="container-wide">
          <div className="grid gap-6 md:grid-cols-3">
            <ValueCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Evidence you can trust"
              body="Every red flag is tied to the specific phrase, domain, or pattern that triggered it — so you can judge the reasoning for yourself."
            />
            <ValueCard
              icon={<Lightbulb className="h-5 w-5" />}
              title="Guidance you can act on"
              body="Instead of vague warnings, you get concrete next steps tailored to the threat type — what to do now, and what to do if you already acted."
            />
            <ValueCard
              icon={<Hand className="h-5 w-5" />}
              title="No overreach"
              body="SuSagi never blocks or reports content on your behalf. It gives you clear, platform-agnostic instructions so you stay in control."
            />
          </div>
        </div>
      </section>

      {/* ──────────────── CTA ──────────────── */}
      <section className="bg-ink-950 py-20">
        <div className="container-wide">
          <div className="relative overflow-hidden rounded-3xl border border-ink-800 bg-gradient-to-br from-ink-900 via-ink-900 to-brand-950 px-8 py-14 text-white sm:px-14">
            <div className="relative max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Got a message you&apos;re unsure about? Check it in seconds.
              </h2>
              <p className="mt-4 text-white/80">
                Paste the content, pick a mode, and get a clear risk verdict with
                reasoning and safe next steps. No account needed.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/analyze"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-ink-950 transition hover:bg-white/90"
                >
                  Start an analysis <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/insights"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Explore safety insights
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */

function ModeCard({
  icon,
  title,
  lede,
  bullets,
}: {
  icon: React.ReactNode;
  title: string;
  lede: string;
  bullets: string[];
}) {
  return (
    <article className="card group p-6 transition hover:border-ink-700">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-950 text-brand-400">
          {icon}
        </span>
        <h3 className="text-lg font-semibold text-ink-50">{title}</h3>
      </div>
      <p className="mt-4 text-sm text-ink-300">{lede}</p>
      <ul className="mt-4 space-y-2 text-sm text-ink-300">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ValueCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-ink-50">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative rounded-3xl border border-ink-800 bg-ink-900/70 p-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="chip">
          <MessageSquareWarning className="h-3.5 w-3.5 text-brand-400" />
          Message Check
        </span>
        <span className="chip border-red-800 bg-red-950/50 text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          High Risk
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-ink-950 p-4 text-sm leading-relaxed text-ink-200">
        <span className="phrase-highlight">URGENT:</span> Your BCA account is{" "}
        <span className="phrase-highlight">suspended</span>. Verify now with{" "}
        <span className="phrase-highlight">OTP 828311</span> at{" "}
        <span className="phrase-highlight">http://bca-secure.xyz/login</span>{" "}
        within <span className="phrase-highlight">30 minutes</span>.
      </div>

      <div className="mt-5 space-y-3">
        <PreviewRow label="Threat category" value="Phishing" />
        <PreviewRow label="Confidence range" value="90 – 100" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Why it was flagged
          </div>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-300">
            <li>• Requests sensitive credentials (OTP)</li>
            <li>• Uses urgency language to pressure you</li>
            <li>• Combines a suspicious link with that pressure</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-ink-800 bg-ink-900/60 px-3 py-2 text-sm">
      <span className="text-ink-400">{label}</span>
      <span className="font-semibold text-ink-50">{value}</span>
    </div>
  );
}

function ExampleScenarios() {
  const scenarios = [
    {
      tag: "Suspicious bank message",
      body: "\"Your account has been suspended. Click here to re-verify with your OTP within 30 minutes.\"",
      verdict: "High Risk · Phishing",
    },
    {
      tag: "Fake recruiter DM",
      body: "\"Congratulations! You're hired immediately at $500/day. Please pay a $50 training fee to get started.\"",
      verdict: "Likely Scam · Fake Job Offer",
    },
    {
      tag: "Misleading parcel link",
      body: "\"Your parcel could not be delivered. Reschedule at http://dhl-delivery.xyz/update.\"",
      verdict: "Suspicious · Suspicious Link",
    },
  ];
  return (
    <div className="space-y-4">
      {scenarios.map((s) => (
        <div key={s.tag} className="card p-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{s.tag}</span>
            <span className="chip border-red-800 bg-red-950/50 text-red-300">
              {s.verdict}
            </span>
          </div>
          <p className="mt-3 text-sm italic leading-relaxed text-ink-300">
            {s.body}
          </p>
        </div>
      ))}
    </div>
  );
}
