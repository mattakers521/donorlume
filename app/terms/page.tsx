import fs from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { marked } from "marked";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — DonorLume",
  description: "Terms of Service for DonorLume by Vibrant Causes, LLC.",
};

export default async function TermsRoute() {
  const file = await fs.readFile(
    path.join(process.cwd(), "DONORLUME-TERMS.md"),
    "utf8",
  );
  // Strip the "Feed this file to Claude Code…" instruction line so it
  // doesn't surface to readers of the public page.
  const cleaned = file.replace(
    /\*Feed this file to Claude Code[^*]+\*/,
    "",
  );
  const html = await marked.parse(cleaned);
  return <LegalPage html={html} />;
}
