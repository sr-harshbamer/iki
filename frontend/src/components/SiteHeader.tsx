"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";

const links = [
  { href: "/analyze", label: "Analyze" },
  { href: "/live", label: "Live Guard" },
  { href: "/insights", label: "Safety Insights" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/80 backdrop-blur">
      <div className="container-wide flex h-16 items-center justify-between gap-2">
        <Link href="/" aria-label="SuSagi home" className="shrink-0">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:flex" />
        </Link>
        <nav className="flex min-w-0 flex-nowrap items-center gap-0.5 overflow-x-auto sm:gap-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition sm:px-3 sm:text-sm",
                  active
                    ? "bg-ink-100 text-ink-900"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
                )}
              >
                {l.href === "/insights" ? (
                  <>
                    <span className="sm:hidden">Insights</span>
                    <span className="hidden sm:inline">{l.label}</span>
                  </>
                ) : (
                  l.label
                )}
              </Link>
            );
          })}
          <Link href="/analyze" className="btn-brand ml-1 hidden shrink-0 sm:ml-2 sm:inline-flex">
            Analyze content
          </Link>
        </nav>
      </div>
    </header>
  );
}
