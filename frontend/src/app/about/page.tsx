import Link from "next/link";
import {
  BookOpenCheck,
  Compass,
  Gauge,
  HeartHandshake,
  Microscope,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CornerDots, SectionRule } from "@/components/CornerDots";

export default function AboutPage() {
  return (
    <>
      {/* ── Header ─────────────────────────────────────────────── */}
      <section className="border-b border-ink-800 bg-ink-950">
        <div className="container-wide py-14 sm:py-20">
          <span className="eyebrow">About SuSagi</span>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-ink-50 sm:text-5xl">
            Everyday cyber safety, explained in plain language.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-300">
            SuSagi helps ordinary people evaluate suspicious messages, links,
            and job offers with the same kind of reasoning a careful security
            professional would apply — without the jargon, the guesswork, or
            the false certainty.
          </p>
        </div>
      </section>

      {/* ── Motivation ─────────────────────────────────────────── */}
      <section className="bg-ink-950 py-16">
        <div className="container-wide grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <span className="eyebrow">Why this exists</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50">
              Most scams don&apos;t need sophisticated attackers — just a confused
              person on the other end.
            </h2>
          </div>
          <div className="prose-tight space-y-5 text-ink-300 lg:col-span-7">
            <p>
              The majority of financial loss from digital fraud does not come
              from novel exploits. It comes from ordinary text messages, DMs,
              and emails that trick people into sharing an OTP, clicking a
              convincing-looking link, or paying a &quot;processing fee&quot; for a
              job that does not exist.
            </p>
            <p>
              Professional security tools exist, but they are built for
              enterprise defenders, not for someone checking a suspicious SMS at
              a bus stop. SuSagi fills that gap: a clean, public-facing
              platform that takes content a person is already unsure about and
              returns a clear, explainable verdict they can act on.
            </p>
          </div>
        </div>
      </section>

      {/* ── What SuSagi analyses ──────────────────────────────── */}
      <section className="bg-black/20 py-16">
        <div className="container-wide">
          <div className="max-w-2xl">
            <span className="eyebrow">How SuSagi analyses content</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50">
              Each mode looks for the red flags that actually matter for that
              kind of content.
            </h2>
          </div>

          <div className="relative mt-10 grid overflow-hidden rounded-2xl border border-ink-800 md:grid-cols-3 md:divide-x md:divide-ink-800">
            <CornerDots />
            <MethodCard
              id="phishing"
              icon={<Microscope className="h-5 w-5" />}
              title="Message analysis"
              body="Detects urgency pressure, OTP and credential requests, brand impersonation, reward bait, financial fraud wording, and coercive threats. Combined signals (like a suspicious link next to an OTP request) carry extra weight."
            />
            <MethodCard
              id="links"
              icon={<Compass className="h-5 w-5" />}
              title="Link analysis"
              body="Parses the URL structure, checks abuse-prone TLDs, URL shorteners, raw-IP hosts, lookalike brand domains via edit distance, subdomain tricks, punycode, and login-style paths on disposable hosts."
            />
            <MethodCard
              id="jobs"
              icon={<HeartHandshake className="h-5 w-5" />}
              title="Job offer analysis"
              body="Flags unrealistic pay, upfront fees and deposits, rushed hiring without interviews, premature requests for ID or bank details, mule-style roles, off-channel contact pushes, and free-email recruiters."
            />
          </div>
        </div>
      </section>

      {/* ── The six output layers ──────────────────────────────── */}
      <section className="bg-ink-950 py-16">
        <div className="container-wide">
          <div className="max-w-2xl">
            <span className="eyebrow">The six output layers</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50">
              A verdict alone is not enough.
            </h2>
            <p className="mt-4 text-ink-300">
              Every SuSagi analysis returns six layers, from the headline risk
              level all the way down to concrete next steps. Each layer is
              grounded in the specific evidence the analyser saw.
            </p>
          </div>

          <div className="mt-10">
            <SectionRule />
          </div>
          <ol className="relative mt-6 grid overflow-hidden rounded-2xl border border-ink-800 sm:grid-cols-2 sm:divide-x sm:divide-ink-800 lg:grid-cols-3">
            <CornerDots />
            <LayerCard
              n="01"
              icon={<Gauge className="h-4 w-4" />}
              title="Risk Level"
              body="Safe, Low Risk, Suspicious, Likely Scam, or High Risk — with a 0–100 score and a confidence range."
            />
            <LayerCard
              n="02"
              icon={<ShieldAlert className="h-4 w-4" />}
              title="Threat Category"
              body="What kind of threat this looks like: phishing, OTP scam, fake job offer, suspicious link, impersonation, financial fraud, or unclassified suspicious pattern."
            />
            <LayerCard
              n="03"
              icon={<Microscope className="h-4 w-4" />}
              title="Why It Was Flagged"
              body="The exact patterns that triggered — urgency wording, brand-impersonation subdomains, recruiter fee requests, etc. — with the matched evidence shown."
            />
            <LayerCard
              n="04"
              icon={<ShieldAlert className="h-4 w-4" />}
              title="Why You Should Not Proceed"
              body="What could realistically happen if you act on the content, expressed in ordinary language."
            />
            <LayerCard
              n="05"
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Recommended Safe Action"
              body="Concrete steps tailored to the threat type, including what to do if you have already acted."
            />
            <LayerCard
              n="06"
              icon={<BookOpenCheck className="h-4 w-4" />}
              title="Block & Report Guidance"
              body="Platform-agnostic steps to block the sender and report the content through the channels you already use."
            />
          </ol>
        </div>
      </section>

      {/* ── Principles ──────────────────────────────────────────── */}
      <section className="bg-black/20 py-16">
        <div className="container-wide grid gap-8 lg:grid-cols-3">
          <Principle
            title="Explainability over certainty"
            body="Security verdicts that can't be explained are security theater. SuSagi shows its work, so users can judge the reasoning themselves."
          />
          <Principle
            title="Guidance, not action"
            body="SuSagi never automatically blocks, reports, or replies to anything on your behalf. It gives you the steps — you stay in control."
          />
          <Principle
            title="Public, not gatekept"
            body="Ordinary people face the same social-engineering attacks that professionals defend against. The tools to evaluate them should be public too."
          />
        </div>
      </section>

      {/* ── Who it's for ────────────────────────────────────────── */}
      <section className="bg-ink-950 py-16">
        <div className="container-wide grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <span className="eyebrow">Who it&apos;s for</span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-50">
              Built for the person who says &quot;this feels off.&quot;
            </h2>
          </div>
          <ul className="space-y-5 text-ink-300 lg:col-span-7">
            <Audience
              icon={<Users className="h-5 w-5" />}
              title="Anyone receiving suspicious messages"
              body="Parents, students, freelancers, small-business owners — people who get a dodgy SMS or DM and want a second opinion in under a minute."
            />
            <Audience
              icon={<Users className="h-5 w-5" />}
              title="Job seekers navigating online recruiters"
              body="Especially on platforms where fake recruiters, advance-fee jobs, and identity-theft setups routinely reach applicants."
            />
            <Audience
              icon={<Users className="h-5 w-5" />}
              title="Community helpers and educators"
              body="People who informally help family or friends assess risky content, and want a clear explanation they can point to."
            />
          </ul>
        </div>
      </section>

      {/* ── Disclaimer ──────────────────────────────────────────── */}
      <section className="bg-ink-950 pb-20">
        <div className="container-wide">
          <div className="rounded-3xl border border-ink-800 bg-ink-900/40 p-8 sm:p-10">
            <h2 className="text-lg font-semibold text-ink-50">
              Important scope and limitations
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">
              SuSagi is a decision-support and educational platform. It does{" "}
              <strong className="text-ink-100">not</strong> replace official cybersecurity authorities,
              law-enforcement reporting channels, or your bank&apos;s fraud
              department. Results reflect heuristic analysis of the content you
              provide and should be read as a guide, not a guarantee. When
              something matters — money, identity documents, or account access
              — verify through the sender&apos;s official channels before acting.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/analyze" className="btn-brand">
                Try an analysis
              </Link>
              <Link href="/insights" className="btn-outline">
                View safety insights
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */

function MethodCard({
  id,
  icon,
  title,
  body,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article id={id} className="bg-ink-950/60 p-8 transition hover:bg-ink-900/40">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-950 text-brand-400">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-ink-50">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-300">{body}</p>
    </article>
  );
}

function LayerCard({
  n,
  icon,
  title,
  body,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="bg-ink-950/60 p-6 transition hover:bg-ink-900/40">
      <span className="grid h-10 w-10 place-items-center rounded-lg border border-ink-700 text-sm font-bold text-ink-50">
        {n}
      </span>
      <div className="mt-4 flex items-center gap-2 text-brand-400">
        {icon}
        <h3 className="text-base font-semibold text-ink-50">{title}</h3>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{body}</p>
    </li>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-ink-50">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-300">{body}</p>
    </div>
  );
}

function Audience({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-950 text-brand-400">
        {icon}
      </span>
      <div>
        <h3 className="text-base font-semibold text-ink-50">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-400">{body}</p>
      </div>
    </li>
  );
}
