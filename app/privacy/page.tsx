import fs from "node:fs/promises";
import path from "node:path";

import type { Metadata } from "next";
import { marked } from "marked";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — DonorLume",
  description: "Privacy Policy for DonorLume by Vibrant Causes, LLC.",
};

export default async function PrivacyRoute() {
  const file = await fs.readFile(
    path.join(process.cwd(), "DONORLUME-PRIVACY.md"),
    "utf8",
  );
  const cleaned = file.replace(
    /\*Feed this file to Claude Code[^*]+\*/,
    "",
  );
  const html = await marked.parse(cleaned);
  return <LegalPage html={html} />;
}
