"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bookmark,
  Building2,
  Check,
  ChevronLeft,
  DollarSign,
  FileText,
  Loader as LoaderIcon,
  Search,
  Sparkles,
} from "lucide-react";

import { C, brandGradient, inputStyle, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import {
  CAUSE_SUGGESTIONS,
  US_STATES,
  nteeLabel,
} from "@/lib/discover-data";
import type {
  DetailsResponse,
  SearchOrg,
  SearchResponse,
} from "@/lib/propublica";
import { StarburstLogo } from "@/components/starburst-logo";
import { useToast } from "@/components/toast/toast-provider";

type Props = {
  /** Initial saved prospects: [ein, prospect.id] pairs from the server. */
  initialSaved: [string, string][];
};

type SavePayload = {
  ein: string;
  name: string;
  city?: string | null;
  state?: string | null;
  nteeCode?: string | null;
  revenue?: number | null;
  assets?: number | null;
};

export function DiscoverClient({ initialSaved }: Props) {
  const { toast } = useToast();
  const router = useRouter();

  // Search state
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [results, setResults] = useState<SearchOrg[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Detail state
  const [detailEin, setDetailEin] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailsResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Saved-prospects map (ein → prospect.id). "pending" while POST in flight.
  const [saved, setSaved] = useState<Map<string, string>>(
    () => new Map(initialSaved),
  );

  const search = useCallback(
    async (query: string, st: string, pg: number = 0) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      setSearchLoading(true);
      setSearchError(null);
      setDetailEin(null);
      setDetail(null);
      try {
        const url = new URL("/api/propublica/search", window.location.origin);
        url.searchParams.set("q", trimmed);
        if (st) url.searchParams.set("state", st);
        if (pg > 0) url.searchParams.set("page", String(pg));
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data: SearchResponse = await res.json();
        setResults(data.organizations || []);
        setTotal(data.total_results || 0);
        setPage(pg);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Search failed";
        setSearchError(message);
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  const viewOrg = useCallback(async (ein: string) => {
    setDetailLoading(true);
    setDetailEin(ein);
    setDetail(null);
    setDetailError(null);
    try {
      const res = await fetch(`/api/propublica/${encodeURIComponent(ein)}`);
      if (!res.ok) throw new Error(`Lookup failed (${res.status})`);
      const data: DetailsResponse = await res.json();
      setDetail(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Lookup failed";
      setDetailError(message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const toggleSave = useCallback(
    async (ein: string, payload: Omit<SavePayload, "ein">) => {
      const existing = saved.get(ein);

      if (existing && existing !== "pending") {
        // Optimistic remove
        setSaved((prev) => {
          const m = new Map(prev);
          m.delete(ein);
          return m;
        });
        const res = await fetch(`/api/prospects/${existing}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          // Roll back
          setSaved((prev) => {
            const m = new Map(prev);
            m.set(ein, existing);
            return m;
          });
        }
        return;
      }

      // Optimistic add
      setSaved((prev) => {
        const m = new Map(prev);
        m.set(ein, "pending");
        return m;
      });
      try {
        const res = await fetch("/api/prospects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ein, ...payload }),
        });
        if (!res.ok) throw new Error("Save failed");
        const body = (await res.json()) as {
          prospect: { id: string };
          firstProspect?: boolean;
        };
        setSaved((prev) => {
          const m = new Map(prev);
          m.set(ein, body.prospect.id);
          return m;
        });
        // Onboarding signal — first-ever prospect save earns a toast +
        // re-renders the layout so the persistent progress bar updates.
        if (body.firstProspect) {
          toast({
            kind: "onboarding",
            title: "Step complete!",
            body: "You've saved your first prospect.",
            action: { label: "Continue setup", href: "/dashboard" },
          });
          router.refresh();
        }
      } catch {
        // Roll back
        setSaved((prev) => {
          const m = new Map(prev);
          m.delete(ein);
          return m;
        });
      }
    },
    [saved, router, toast],
  );

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────
  if (detailEin) {
    return (
      <DetailView
        ein={detailEin}
        loading={detailLoading}
        error={detailError}
        data={detail}
        saved={saved}
        onBack={() => {
          setDetailEin(null);
          setDetail(null);
          setDetailError(null);
        }}
        onToggleSave={toggleSave}
      />
    );
  }

  // ── SEARCH VIEW ─────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100 }}>
      {/* First-run guidance — visible until the user saves a prospect.
          Disappears the moment `saved.size` flips to > 0 (optimistic update
          on save fires synchronously, so the banner clears immediately). */}
      {saved.size === 0 && <DiscoverOnboardingBanner />}

      {/* Search bar card */}
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          boxShadow: shadow.sm,
          padding: 28,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280, position: "relative" }}>
            <Search
              size={18}
              color={C.textTertiary}
              style={{ position: "absolute", left: 16, top: 15 }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") search(q, stateFilter);
              }}
              placeholder="Search by cause, keyword, or organization..."
              style={{ ...inputStyle, paddingLeft: 46 }}
            />
          </div>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{
              padding: "14px 18px",
              borderRadius: 14,
              border: `1.5px solid ${C.border}`,
              fontSize: 15,
              backgroundColor: C.surface,
              cursor: "pointer",
              minWidth: 120,
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <option value="">All States</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => search(q, stateFilter)}
            disabled={searchLoading || !q.trim()}
            style={{
              padding: "14px 28px",
              borderRadius: 14,
              border: "none",
              background: q.trim() ? brandGradient : "#E5E5EA",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: q.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            {searchLoading ? (
              <>
                <LoaderIcon size={16} className="spin" /> Searching…
              </>
            ) : (
              <>
                <Search size={16} /> Search
              </>
            )}
          </button>
        </div>

        {!results && !searchLoading && (
          <div style={{ marginTop: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 12,
              }}
            >
              Try searching for
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CAUSE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQ(s);
                    search(s, stateFilter);
                  }}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 100,
                    border: "none",
                    backgroundColor: "#F2F2F7",
                    fontSize: 14,
                    color: C.textSecondary,
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all 0.15s",
                    fontFamily:
                      "var(--font-jakarta), -apple-system, sans-serif",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = C.amberLight;
                    e.currentTarget.style.color = C.amber;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#F2F2F7";
                    e.currentTarget.style.color = C.textSecondary;
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {searchError && (
        <div
          style={{
            backgroundColor: C.orangeLight,
            borderRadius: 16,
            padding: "16px 22px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={18} color={C.orange} />
          <span style={{ fontSize: 14, color: C.orange, fontWeight: 600 }}>
            {searchError}
          </span>
        </div>
      )}

      {searchLoading && (
        <div style={{ textAlign: "center", padding: 80 }}>
          <LoaderIcon size={32} color={C.amber} className="spin" />
          <p style={{ marginTop: 16, color: C.textTertiary }}>
            Searching nonprofit filings…
          </p>
        </div>
      )}

      {!searchLoading && results && (
        <ResultsTable
          results={results}
          total={total}
          page={page}
          saved={saved}
          onView={viewOrg}
          onToggleSave={toggleSave}
          onPage={(next) => search(q, stateFilter, next)}
        />
      )}

      {!results && !searchLoading && !searchError && <EmptyHero />}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ResultsTable({
  results,
  total,
  page,
  saved,
  onView,
  onToggleSave,
  onPage,
}: {
  results: SearchOrg[];
  total: number;
  page: number;
  saved: Map<string, string>;
  onView: (ein: string) => void;
  onToggleSave: (ein: string, payload: Omit<SavePayload, "ein">) => void;
  onPage: (next: number) => void;
}) {
  // Show the onboarding helper only while the user has zero saves of any
  // kind (initial load + post-save updates). Once they save one, it
  // disappears — and stays gone for the rest of the session, since
  // toggleSave can't drop a real `prospect.id` back to no entry except
  // via an explicit unsave (which still leaves them having "experienced
  // saving" at least once — that's the bar).
  const hasNoSaves = saved.size === 0;

  return (
    <>
      {hasNoSaves && <EmptySavedHelper />}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 14, color: C.textSecondary }}>
          <strong style={{ color: C.text }}>{total.toLocaleString()}</strong>{" "}
          results
        </span>
        <span style={{ fontSize: 13, color: C.textTertiary }}>
          Page {page + 1}
        </span>
      </div>

      {results.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            backgroundColor: C.surface,
            borderRadius: 20,
            boxShadow: shadow.sm,
          }}
        >
          <p style={{ color: C.textTertiary }}>No results found.</p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 20,
            boxShadow: shadow.sm,
            overflow: "hidden",
          }}
        >
          <div className="app-scroll-x">
          <table
            style={{
              width: "100%",
              minWidth: 820,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                {["Organization", "Location", "Category", "Revenue", "Assets", ""].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: C.textTertiary,
                        textAlign: "left",
                        padding: "14px 20px",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {results.map((o) => {
                const ein = String(o.ein);
                const saveState: "saved" | "pending" | "idle" = saved.has(ein)
                  ? saved.get(ein) === "pending"
                    ? "pending"
                    : "saved"
                  : "idle";
                return (
                  <tr
                    key={ein}
                    onClick={() => onView(ein)}
                    style={{
                      borderTop: `1px solid ${C.borderSubtle}`,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = C.surfaceHover)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    <td style={{ padding: "16px 20px" }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: C.text,
                        }}
                      >
                        {o.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.textTertiary }}>
                        EIN: {ein}
                      </div>
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      {o.city ? (
                        <span
                          style={{ fontSize: 14, color: C.textSecondary }}
                        >
                          {o.city}
                          {o.state ? `, ${o.state}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "16px 20px" }}>
                      {o.ntee_code ? (
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            backgroundColor: C.purpleLight,
                            color: C.purple,
                          }}
                        >
                          {nteeLabel(o.ntee_code)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: 15,
                        fontWeight: 700,
                      }}
                    >
                      {fmt(o.income_amount ?? null)}
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        fontSize: 14,
                        color: C.textSecondary,
                      }}
                    >
                      {fmt(o.asset_amount ?? null)}
                    </td>
                    <td
                      style={{
                        padding: "16px 20px",
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <SaveToPipelineButton
                        state={saveState}
                        size="compact"
                        onClick={() =>
                          onToggleSave(ein, {
                            name: o.name,
                            city: o.city ?? null,
                            state: o.state ?? null,
                            nteeCode: o.ntee_code ?? null,
                            revenue: o.income_amount ?? null,
                            assets: o.asset_amount ?? null,
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {total > 25 && (
            <div
              style={{
                padding: "16px 20px",
                borderTop: `1px solid ${C.borderSubtle}`,
                display: "flex",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <button
                type="button"
                disabled={page === 0}
                onClick={() => onPage(page - 1)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#F2F2F7",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: page === 0 ? "default" : "pointer",
                  opacity: page === 0 ? 0.5 : 1,
                  fontFamily:
                    "var(--font-jakarta), -apple-system, sans-serif",
                }}
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => onPage(page + 1)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#F2F2F7",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily:
                    "var(--font-jakarta), -apple-system, sans-serif",
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function DetailView({
  ein,
  loading,
  error,
  data,
  saved,
  onBack,
  onToggleSave,
}: {
  ein: string;
  loading: boolean;
  error: string | null;
  data: DetailsResponse | null;
  saved: Map<string, string>;
  onBack: () => void;
  onToggleSave: (ein: string, payload: Omit<SavePayload, "ein">) => void;
}) {
  // Hook order: declare before any early returns.
  // (Currently no hooks here, but easier to extend safely.)

  if (loading) {
    return (
      <div style={{ maxWidth: 1000 }}>
        <BackButton onBack={onBack} />
        <div style={{ textAlign: "center", padding: 80 }}>
          <LoaderIcon size={32} color={C.amber} className="spin" />
          <p style={{ marginTop: 16, color: C.textTertiary }}>
            Loading filings for EIN {ein}…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data?.organization) {
    return (
      <div style={{ maxWidth: 1000 }}>
        <BackButton onBack={onBack} />
        <div
          style={{
            backgroundColor: C.orangeLight,
            borderRadius: 16,
            padding: "16px 22px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <AlertCircle size={18} color={C.orange} />
          <span style={{ fontSize: 14, color: C.orange, fontWeight: 600 }}>
            {error || "Couldn’t load this organization."}
          </span>
        </div>
      </div>
    );
  }

  const o = data.organization;
  const filings = (data.filings_with_data || []).slice(0, 6);
  const lf = filings[0] || ({} as (typeof filings)[number]);
  const orgEin = String(o.ein);

  const grants =
    (lf.grntstogovt || 0) +
    (lf.grntstoindiv || 0) +
    (lf.grntstofrgngovt || 0);

  const metrics = [
    {
      label: "Revenue",
      value: fmt(lf.totrevenue ?? null),
      color: C.amber,
      bg: C.amberLight,
      Icon: DollarSign,
    },
    {
      label: "Expenses",
      value: fmt(lf.totfuncexpns ?? null),
      color: C.orange,
      bg: C.orangeLight,
      Icon: FileText,
    },
    {
      label: "Assets",
      value: fmt(lf.totassetsend ?? null),
      color: C.purple,
      bg: C.purpleLight,
      Icon: Building2,
    },
    {
      label: "Grants",
      value: fmt(grants || null),
      color: C.green,
      bg: C.greenLight,
      Icon: Sparkles,
    },
  ];

  return (
    <div style={{ maxWidth: 1000 }}>
      <BackButton onBack={onBack} />

      {/* Org header */}
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          boxShadow: shadow.md,
          padding: 32,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                backgroundColor: C.amberLight,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={26} color={C.amber} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 24,
                  fontWeight: 400,
                  margin: 0,
                  fontFamily:
                    "var(--font-instrument-serif), Georgia, serif",
                }}
              >
                {o.name}
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: C.textTertiary,
                  margin: "4px 0 0",
                }}
              >
                EIN: {orgEin}
                {o.city && ` · ${o.city}${o.state ? `, ${o.state}` : ""}`}
              </p>
            </div>
          </div>

          <SaveToPipelineButton
            state={
              saved.has(orgEin)
                ? saved.get(orgEin) === "pending"
                  ? "pending"
                  : "saved"
                : "idle"
            }
            size="large"
            onClick={() =>
              onToggleSave(orgEin, {
                name: o.name,
                city: o.city ?? null,
                state: o.state ?? null,
                nteeCode: o.ntee_code ?? null,
                revenue: lf.totrevenue ?? null,
                assets: lf.totassetsend ?? null,
              })
            }
          />
        </div>
      </div>

      {/* Metric cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              backgroundColor: C.surface,
              borderRadius: 16,
              boxShadow: shadow.sm,
              padding: "20px 22px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: m.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <m.Icon size={17} color={m.color} />
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: C.textTertiary,
                  fontWeight: 600,
                }}
              >
                {m.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 400,
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
              }}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filing history */}
      {filings.length > 0 && (
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 20,
            boxShadow: shadow.sm,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px 26px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <FileText size={18} color={C.amber} />
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              Filing History
            </h3>
          </div>
          <div className="app-scroll-x">
          <table
            style={{
              width: "100%",
              minWidth: 580,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ borderTop: `1px solid ${C.border}` }}>
                {["Year", "Revenue", "Expenses", "Assets", "PDF"].map((h) => (
                  <th
                    key={h}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.textTertiary,
                      textAlign: "left",
                      padding: "12px 20px",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filings.map((f, i) => (
                <tr
                  key={`${f.tax_prd_yr ?? "?"}-${i}`}
                  style={{ borderTop: `1px solid ${C.borderSubtle}` }}
                >
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 15,
                      fontWeight: 700,
                    }}
                  >
                    {f.tax_prd_yr ?? "—"}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 14,
                      color: C.textSecondary,
                    }}
                  >
                    {fmt(f.totrevenue ?? null)}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 14,
                      color: C.textSecondary,
                    }}
                  >
                    {fmt(f.totfuncexpns ?? null)}
                  </td>
                  <td
                    style={{
                      padding: "14px 20px",
                      fontSize: 14,
                      color: C.textSecondary,
                    }}
                  >
                    {fmt(f.totassetsend ?? null)}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    {f.pdf_url ? (
                      <a
                        href={f.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 13,
                          color: C.amber,
                          textDecoration: "none",
                          fontWeight: 700,
                        }}
                      >
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        color: C.amber,
        background: "none",
        border: "none",
        cursor: "pointer",
        marginBottom: 24,
        padding: 0,
        fontWeight: 600,
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
    >
      <ChevronLeft size={18} /> Back
    </button>
  );
}

function EmptyHero() {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 24,
        boxShadow: shadow.sm,
        padding: "72px 40px",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <StarburstLogo size={96} idKey="discover-empty" />
      </div>
      <h2
        style={{
          fontSize: 26,
          fontWeight: 400,
          margin: "24px 0 0",
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
        }}
      >
        Find your next major gift.
      </h2>
      <p
        style={{
          fontSize: 16,
          color: C.textSecondary,
          maxWidth: 460,
          margin: "14px auto 0",
          lineHeight: 1.6,
        }}
      >
        Search millions of IRS 990 filings to discover foundations and
        organizations giving to causes like yours. No more Googling. No more
        guessing.
      </p>
    </div>
  );
}

/**
 * Prominent "Save to Pipeline" / "Saved ✓" button used in the search
 * table and the detail header. Single source of truth for the
 * save-state visual language — amber gradient when actionable, green
 * tint when complete.
 */
function SaveToPipelineButton({
  state,
  size,
  onClick,
}: {
  state: "saved" | "pending" | "idle";
  size: "compact" | "large";
  onClick: () => void;
}) {
  const isSaved = state === "saved";
  const isPending = state === "pending";

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: size === "large" ? 14 : 12,
    border: "none",
    cursor: isPending ? "default" : "pointer",
    fontFamily: "var(--font-jakarta), sans-serif",
    fontWeight: 700,
    transition: "transform 0.12s, box-shadow 0.12s, background 0.2s",
    fontSize: size === "large" ? 15 : 13,
    padding:
      size === "large" ? "14px 24px" : "10px 16px",
    whiteSpace: "nowrap",
  };

  if (isSaved) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{
          ...base,
          backgroundColor: C.greenLight,
          color: "#1B5E20",
          border: "1px solid rgba(52,199,89,0.35)",
        }}
      >
        <Check size={size === "large" ? 18 : 15} strokeWidth={2.5} />
        {size === "large" ? "Saved to Pipeline" : "Saved"}
      </button>
    );
  }

  if (isPending) {
    return (
      <button
        type="button"
        disabled
        style={{
          ...base,
          background: brandGradient,
          color: "#fff",
          opacity: 0.85,
        }}
      >
        <LoaderIcon size={size === "large" ? 18 : 15} className="spin" />
        Saving…
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        ...base,
        background: brandGradient,
        color: "#fff",
        boxShadow:
          size === "large"
            ? "0 10px 28px rgba(232,134,12,0.32), 0 3px 8px rgba(212,74,26,0.18)"
            : "0 4px 12px rgba(232,134,12,0.25)",
      }}
    >
      <Bookmark size={size === "large" ? 18 : 15} strokeWidth={2.4} />
      {size === "large" ? "Save This Prospect" : "Save to Pipeline"}
    </button>
  );
}

/**
 * Helper banner shown above the results table when the user has saved
 * zero prospects yet. Disappears as soon as they save their first.
 */
function EmptySavedHelper() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "14px 18px",
        marginBottom: 16,
        backgroundColor: C.amberLight,
        border: `1px solid rgba(232,134,12,0.25)`,
        borderRadius: 14,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: brandGradient,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 10px rgba(232,134,12,0.28)",
        }}
      >
        <Sparkles size={16} />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.55,
          color: C.text,
          fontWeight: 500,
        }}
      >
        <strong style={{ fontWeight: 800 }}>New here?</strong> Search for
        organizations aligned with your mission, then click{" "}
        <strong style={{ fontWeight: 800, color: C.amberDark }}>
          Save to Pipeline
        </strong>{" "}
        to start building your prospect list.
      </p>
    </div>
  );
}

/**
 * Top-of-page onboarding card shown until the org has at least one
 * saved prospect. Lives ABOVE the search bar so it's the first thing a
 * first-run user reads on /discover — the brief from the UX pass calls
 * for a card that's "impossible to miss." Amber-tinted, gradient icon
 * badge, two-line directive that names the exact button label
 * ("Save to Pipeline") used on every result row + detail page.
 */
function DiscoverOnboardingBanner() {
  return (
    <div
      role="note"
      aria-label="Getting started with prospect discovery"
      style={{
        position: "relative",
        marginBottom: 24,
        borderRadius: 18,
        padding: 2,
        background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
        boxShadow:
          "0 14px 36px rgba(232,134,12,0.20), 0 4px 12px rgba(212,74,26,0.10)",
      }}
    >
      <div
        style={{
          backgroundColor: C.amberLight,
          borderRadius: 16,
          padding: "20px clamp(20px, 3vw, 28px)",
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            background: brandGradient,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 8px 20px rgba(232,134,12,0.32)",
          }}
        >
          <Bookmark size={22} color="#fff" strokeWidth={2.4} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.amberDark,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Step 2 of onboarding
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: C.text,
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            Search for organizations aligned with your mission, then click{" "}
            <span
              style={{
                background: brandGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontWeight: 800,
              }}
            >
              Save to Pipeline
            </span>{" "}
            on any result to complete this step.
          </div>
        </div>
      </div>
    </div>
  );
}

