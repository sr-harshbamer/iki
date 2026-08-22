"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/cn";

const links = [
  { href: "/analyze", label: "Analyze" },
  { href: "/live", label: "Live Guard" },
  { href: "/susagi", label: "Voice Guard" },
  { href: "/insights", label: "Safety Insights" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A route change always means navigation happened -- close the mobile
  // menu so it never lingers open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/80 bg-white/80 backdrop-blur">
      <div className="container-wide flex h-16 items-center justify-between gap-2">
        <Link href="/" aria-label="SuSagi home" className="shrink-0">
          <Logo compact className="sm:hidden" />
          <Logo className="hidden sm:flex" />
        </Link>

        {/* Desktop nav -- unchanged, fits comfortably at sm and up */}
        <nav className="hidden min-w-0 flex-nowrap items-center gap-0.5 sm:flex sm:gap-1">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} pathname={pathname} />
          ))}
          <Link href="/analyze" className="btn-brand ml-2 shrink-0">
            Analyze content
          </Link>
        </nav>

        {/* Mobile: a hamburger toggle instead of a horizontally-scrolling
            nav -- with 5 links + a CTA, the old scroll-to-see-more pattern
            silently hid "About" and the primary button off-screen with no
            visual hint that more existed. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-700 hover:bg-ink-100 sm:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-ink-200 bg-white px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <NavLink
                key={l.href}
                href={l.href}
                label={l.label}
                pathname={pathname}
                block
              />
            ))}
          </div>
          <Link href="/analyze" className="btn-brand mt-3 w-full justify-center">
            Analyze content
          </Link>
        </nav>
      )}
    </header>
  );
}

function NavLink({
  href,
  label,
  pathname,
  block,
}: {
  href: string;
  label: string;
  pathname: string | null;
  block?: boolean;
}) {
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
        block && "block w-full py-2.5 text-[15px]",
        active
          ? "bg-ink-100 text-ink-900"
          : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
      )}
    >
      {label}
    </Link>
  );
}
