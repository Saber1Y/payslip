"use client";

import { Check, CheckCircle, Copy, Info, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import type { Tone } from "@/lib/format";

/** Stagger index for the `enter` utility. */
export function stagger(i: number): CSSProperties {
  return { "--i": i } as CSSProperties;
}

const BUTTON: Record<"primary" | "secondary" | "ghost" | "danger", string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover shadow-[0_8px_18px_-10px_rgb(29_92_71/0.7)]",
  secondary: "border border-rule-strong bg-sheet text-ink hover:border-ink/40",
  ghost: "text-muted hover:bg-sheet hover:text-ink",
  danger: "border border-breach/40 bg-sheet text-breach hover:bg-breach-soft",
};

export function Button({
  variant = "primary",
  busy = false,
  icon,
  className = "",
  children,
  disabled,
  ...rest
}: ComponentProps<"button"> & { variant?: keyof typeof BUTTON; busy?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`press inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium disabled:cursor-not-allowed disabled:opacity-55 ${BUTTON[variant]} ${className}`}
    >
      {busy ? <SpinnerGap className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

const STAMP: Record<Tone, string> = {
  signed: "border-signed text-signed",
  waiting: "border-waiting text-waiting",
  breach: "border-breach text-breach",
  neutral: "border-rule-strong text-muted",
};

/** A rubber stamp. Rotated, double-ruled, mono caps: the one place type is set in capitals. */
export function Stamp({ tone, children, animate = false }: { tone: Tone; children: ReactNode; animate?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 -rotate-[4deg] items-center rounded-[5px] border-2 px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.08em] uppercase outline outline-1 outline-offset-2 ${
        STAMP[tone]
      } ${tone === "neutral" ? "outline-rule" : "outline-current/25"} ${animate ? "stamp-in" : ""}`}
    >
      {children}
    </span>
  );
}

const PILL: Record<Tone, string> = {
  signed: "bg-signed-soft text-signed",
  waiting: "bg-waiting-soft text-waiting",
  breach: "bg-breach-soft text-breach",
  neutral: "bg-sheet-2 text-muted",
};

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium ${PILL[tone]}`}>{children}</span>;
}

export function Notice({ tone = "neutral", title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  const Icon = tone === "neutral" ? Info : tone === "signed" ? CheckCircle : WarningCircle;
  return (
    <div role={tone === "breach" ? "alert" : "status"} className={`flex gap-3 rounded-xl px-4 py-3 text-[14px] ${PILL[tone]}`}>
      <Icon className="mt-0.5 size-4 shrink-0" weight="bold" aria-hidden />
      <div className="grid gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="opacity-90">{children}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: ReactNode; error?: string | null; htmlFor: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-breach" id={`${htmlFor}-error`}>
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-muted">{hint}</p>
      )}
    </div>
  );
}

export const inputClass =
  "block min-h-11 w-full rounded-[10px] border border-rule-strong bg-sheet px-3.5 text-[15px] text-ink transition-colors hover:border-ink/35 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 aria-[invalid=true]:border-breach";

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" role="status">
      <SpinnerGap className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule-strong bg-sheet px-3 text-[13px] font-medium text-ink hover:border-ink/40"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-signed" weight="bold" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

/** A label and value on one line of a slip. Values are right-aligned figures. */
export function SlipRow({ label, value, emphasis = false }: { label: ReactNode; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${emphasis ? "text-[16px] font-semibold" : "text-[14.5px]"}`}>
      <span className={emphasis ? "text-ink" : "text-muted"}>{label}</span>
      <span className="figures text-right text-ink">{value}</span>
    </div>
  );
}
