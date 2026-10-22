/** A folded slip with a check mark: the record, signed. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
      <path d="M9 7.5h14v17l-2.33-1.5-2.34 1.5L16 23l-2.33 1.5L11.33 23 9 24.5z" fill="var(--sheet)" />
      <path d="M12.2 15.6l2.6 2.6 5-5.2" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
