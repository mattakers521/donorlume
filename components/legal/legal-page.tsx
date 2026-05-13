import { auth } from "@/auth";

import { C } from "@/lib/design";
import { LandingFooter } from "@/components/landing/footer";
import { LandingHeader } from "@/components/landing/header";

type Props = {
  /** Pre-rendered HTML from `marked()`. */
  html: string;
};

export async function LegalPage({ html }: Props) {
  const session = await auth();
  const isAuthed = !!session?.user?.id;

  return (
    <>
      <LandingHeader isAuthed={isAuthed} />
      <main
        style={{
          padding: "64px 24px 96px",
          backgroundColor: C.bg,
          minHeight: "calc(100vh - 200px)",
        }}
      >
        <article
          className="prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
      <LandingFooter />
    </>
  );
}
