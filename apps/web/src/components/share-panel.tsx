"use client";

import { Printer, ShareNetwork, WhatsappLogo } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import type { CreatedShare, ShareView } from "@/lib/views";
import { Button, CopyButton, Field, inputClass, Notice, Pill } from "./ui";

const SUGGESTIONS = ["HOME", "Centre for Domestic Employees", "MOM", "My lawyer"];

/**
 * Lets a worker give one recipient a link to a frozen copy of their packet, print it with a QR code, and
 * revoke any link later. Each recipient gets their own link, so revoking one leaves the others working.
 */
export function SharePanel({ token }: { token: string }) {
  const [shares, setShares] = useState<ShareView[] | null>(null);
  const [label, setLabel] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setShares(await api<ShareView[]>(`/api/w/${token}/shares`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your shared links.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!label.trim()) return setLabelError("Say who this is for, for example HOME");
    setBusy(true);
    setError(null);
    try {
      const share = await api<CreatedShare>(`/api/w/${token}/shares`, { method: "POST", body: { label } });
      setCreated(share);
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    setError(null);
    try {
      setShares(await api<ShareView[]>(`/api/w/${token}/shares/${id}/revoke`, { method: "POST" }));
      if (created?.id === id) setCreated(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't revoke that link.");
    }
  }

  const active = shares?.filter((s) => !s.revokedAt) ?? [];
  return (
    <section className="slip grid gap-4 p-5" aria-labelledby="share-heading">
      <div className="grid gap-1">
        <h2 id="share-heading" className="flex items-center gap-2 font-serif text-lg font-semibold">
          <ShareNetwork className="size-5 text-accent" aria-hidden />
          Share with an NGO or MOM
        </h2>
        <p className="text-[14px] text-muted">
          Each person gets their own link to a copy of your records as they are today. They check it against the blockchain themselves. You can stop any link
          at any time.
        </p>
      </div>

      {created ? (
        <div className="enter grid gap-3 rounded-xl border border-accent/30 bg-accent-soft/60 p-4">
          <p className="text-[14px] font-medium text-accent">Link for {created.label} is ready</p>
          <p className="figures rounded-lg bg-sheet px-3 py-2 text-[12.5px] break-all">{created.url}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={created.url} label="Copy link" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`My Payslip salary records, signed and checked against the blockchain: ${created.url}`)}`}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule-strong bg-sheet px-3 text-[13px] font-medium hover:border-ink/40"
            >
              <WhatsappLogo className="size-3.5" aria-hidden />
              Send on WhatsApp
            </a>
            <Link
              href={`${new URL(created.url).pathname}/print`}
              className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-rule-strong bg-sheet px-3 text-[13px] font-medium hover:border-ink/40"
            >
              <Printer className="size-3.5" aria-hidden />
              Print with QR code
            </Link>
          </div>
          <p className="text-[12.5px] text-muted">Save or send it now. For your safety Payslip keeps only a fingerprint of this link, so it can&apos;t be shown again.</p>
          <button type="button" className="w-fit text-[13px] text-accent underline underline-offset-2" onClick={() => setCreated(null)}>
            Make another link
          </button>
        </div>
      ) : (
        <form onSubmit={create} noValidate className="grid gap-3">
          <Field label="Who is this for?" htmlFor="share-label" error={labelError}>
            <input
              id="share-label"
              className={inputClass}
              value={label}
              maxLength={60}
              placeholder="HOME"
              list="share-suggestions"
              aria-invalid={!!labelError}
              onChange={(e) => {
                setLabel(e.target.value);
                setLabelError(null);
              }}
            />
          </Field>
          <datalist id="share-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button type="submit" busy={busy} variant="secondary" icon={<ShareNetwork className="size-4" aria-hidden />} className="w-fit">
            Create a share link
          </Button>
        </form>
      )}

      {error && <Notice tone="breach">{error}</Notice>}

      {active.length > 0 && (
        <div className="grid gap-2">
          <p className="text-[13px] font-medium text-muted">Links that work now</p>
          <ul className="divide-y divide-rule/70 rounded-xl border border-rule">
            {active.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[14px]">
                <span className="grid">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-[12.5px] text-muted">
                    {dateLabel(s.createdAt.slice(0, 10))} · {s.months} month{s.months === 1 ? "" : "s"}
                  </span>
                </span>
                <Button variant="danger" className="min-h-9 px-3 text-[13px]" onClick={() => void revoke(s.id)}>
                  Stop this link
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {shares && shares.some((s) => s.revokedAt) && (
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
          Stopped:
          {shares
            .filter((s) => s.revokedAt)
            .map((s) => (
              <Pill key={s.id} tone="neutral">
                {s.label}
              </Pill>
            ))}
        </p>
      )}
    </section>
  );
}
