/**
 * The small square dot at each corner of a bordered panel -- Hiya's
 * recurring signature detail (numbered process cards, partner cards, the
 * hero's network diagram all use it). Purely decorative: absolutely
 * positioned over a `relative` parent, so it never affects layout.
 */
export function CornerDots({ className = "" }: { className?: string }) {
  const dot = "absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[1px] bg-brand-500";
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className={`${dot} left-0 top-0`} />
      <span className={`${dot} right-0 top-0 translate-x-1/2`} />
      <span className={`${dot} bottom-0 left-0 translate-y-1/2`} />
      <span className={`${dot} bottom-0 right-0 translate-x-1/2 translate-y-1/2`} />
    </span>
  );
}

/**
 * The full-width rule with a single marker dot at the left edge that Hiya
 * runs above its numbered-card rows -- a small "blueprint diagram" touch
 * that separates a section without another heavy heading.
 */
export function SectionRule() {
  return (
    <div className="relative border-t border-ink-800">
      <span className="absolute -top-[3px] left-0 h-1.5 w-1.5 rounded-[1px] bg-brand-500" />
    </div>
  );
}
