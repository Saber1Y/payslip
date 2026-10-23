import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { MyRecordsLink } from "@/components/my-records-link";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Payslip",
  description: "Salary records that domestic workers own. Both sides sign every month, and a fingerprint goes on-chain so nobody can rewrite it.",
  applicationName: "Payslip",
  appleWebApp: { capable: true, title: "Payslip", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f4f0e6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-[100dvh] font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-sheet focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <div className="relative z-10 flex min-h-[100dvh] flex-col">
          <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between gap-4 px-4 pt-5 sm:px-8">
            <Link href="/" className="press flex items-center gap-2.5 rounded-md" aria-label="Payslip home">
              <Logo />
              <span className="font-serif text-[19px] font-semibold tracking-[-0.01em]">Payslip</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <MyRecordsLink />
              <Link href="/verify" className="press rounded-full px-3 py-1.5 whitespace-nowrap text-muted hover:bg-sheet hover:text-ink">
                <span className="sm:hidden">Verify</span>
                <span className="hidden sm:inline">Verify a packet</span>
              </Link>
              <Link href="/start" className="press hidden rounded-full px-3 py-1.5 text-muted hover:bg-sheet hover:text-ink sm:inline">
                For employers
              </Link>
            </nav>
          </header>
          <main id="main" className="flex-1">
            {children}
          </main>
          <footer className="mx-auto w-full max-w-[1080px] px-4 py-8 text-[13px] text-muted sm:px-8">
            <div className="perforation mb-5" />
            <p className="mb-2">
              Lost your link?{" "}
              <Link href="/recover" className="text-accent underline underline-offset-2">
                Find your records with your passkey
              </Link>
              .
            </p>
            <p>
              Testnet software. Payslip helps people keep evidence of what was agreed and paid. It is not legal advice and does not replace MOM&apos;s
              processes.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
