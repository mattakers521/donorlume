"use client";

import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import { C } from "@/lib/design";
import {
  FAQ_CATEGORIES,
  FAQS,
  type FaqCategory,
  type FaqItem,
} from "@/components/help/help-faq-data";

/**
 * Searchable + category-filtered FAQ.
 *
 * Same collapsible row style as the landing page (`components/landing/faq.tsx`)
 * but light-themed for the in-app shell. Search matches against question
 * AND answer text (case-insensitive). Results are grouped by category so
 * the structure stays legible even after filtering.
 */
export function HelpFaq() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FaqCategory | "all">("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (!q) return true;
      return (
        f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  // Group by category for the rendered output so categories with no
  // matches simply disappear from the page (keeps the structure
  // self-explanatory without empty headers).
  const grouped = useMemo(() => {
    const byCat = new Map<FaqCategory, FaqItem[]>();
    for (const f of filtered) {
      const arr = byCat.get(f.category) ?? [];
      arr.push(f);
      byCat.set(f.category, arr);
    }
    return FAQ_CATEGORIES.filter((c) => byCat.has(c.key)).map((c) => ({
      ...c,
      items: byCat.get(c.key) ?? [],
    }));
  }, [filtered]);

  const totalCount = FAQS.length;
  const visibleCount = filtered.length;

  return (
    <section style={{ marginBottom: 56 }}>
      {/* Search bar */}
      <div
        style={{
          position: "relative",
          marginBottom: 16,
        }}
      >
        <Search
          size={18}
          color={C.textTertiary}
          style={{
            position: "absolute",
            left: 18,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the help center…"
          aria-label="Search help articles"
          style={{
            width: "100%",
            padding: "14px 44px",
            borderRadius: 14,
            border: `1.5px solid ${C.border}`,
            fontSize: 15,
            color: C.text,
            outline: "none",
            backgroundColor: C.surface,
            fontFamily: "var(--font-jakarta), sans-serif",
            boxSizing: "border-box",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = C.amber;
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(232,134,12,0.10)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              background: C.surfaceHover,
              border: "none",
              borderRadius: 8,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: C.textSecondary,
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category pills */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <CategoryPill
          label={`All (${totalCount})`}
          active={category === "all"}
          onClick={() => setCategory("all")}
        />
        {FAQ_CATEGORIES.map((c) => {
          const count = FAQS.filter((f) => f.category === c.key).length;
          return (
            <CategoryPill
              key={c.key}
              label={`${c.label} (${count})`}
              active={category === c.key}
              onClick={() => setCategory(c.key)}
            />
          );
        })}
      </div>

      {/* Result summary line — only when filtering */}
      {(query || category !== "all") && (
        <div
          style={{
            fontSize: 13,
            color: C.textSecondary,
            fontWeight: 500,
            marginBottom: 14,
          }}
        >
          {visibleCount === 0
            ? `No results for "${query}"`
            : `${visibleCount} of ${totalCount} questions`}
        </div>
      )}

      {/* Grouped results */}
      {grouped.length === 0 ? (
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: "40px 28px",
            textAlign: "center",
            border: `1px solid ${C.border}`,
            color: C.textSecondary,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: C.text }}>
            Nothing matched your search.
          </p>
          <p style={{ margin: 0 }}>
            Try a different keyword, or ask the assistant below — it can
            answer questions the FAQ doesn&rsquo;t cover.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {grouped.map((group) => (
            <div key={group.key}>
              <h3
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.amberDark,
                  textTransform: "uppercase",
                  letterSpacing: 1.4,
                  margin: "0 0 10px",
                }}
              >
                {group.label}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {group.items.map((item, i) => {
                  const key = `${group.key}-${i}`;
                  const isOpen = openKey === key;
                  return (
                    <FaqRow
                      key={key}
                      item={item}
                      query={query}
                      isOpen={isOpen}
                      onToggle={() => setOpenKey(isOpen ? null : key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        border: active
          ? `1px solid ${C.amber}`
          : `1px solid ${C.border}`,
        backgroundColor: active ? C.amberLight : C.surface,
        color: active ? C.amberDark : C.textBody,
        fontFamily: "var(--font-jakarta), sans-serif",
        transition: "background-color 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function FaqRow({
  item,
  query,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  query: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: isOpen ? C.surface : C.bg,
        borderRadius: 14,
        border: isOpen
          ? `1px solid ${C.amberLight}`
          : `1px solid ${C.border}`,
        overflow: "hidden",
        transition: "border-color 0.2s, background-color 0.2s",
        boxShadow: isOpen ? "0 4px 14px rgba(0,0,0,0.04)" : "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        style={{
          width: "100%",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "var(--font-jakarta), sans-serif",
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
            lineHeight: 1.4,
          }}
        >
          <Highlight text={item.q} query={query} />
        </span>
        <Plus
          size={18}
          color={isOpen ? C.amber : C.textTertiary}
          style={{
            flexShrink: 0,
            transform: isOpen ? "rotate(45deg)" : "none",
            transition: "transform 0.2s, color 0.2s",
          }}
        />
      </button>
      {isOpen && (
        <div
          style={{
            padding: "0 20px 20px",
            fontSize: 14.5,
            lineHeight: 1.7,
            color: C.textBody,
            fontWeight: 500,
          }}
        >
          <Highlight text={item.a} query={query} />
        </div>
      )}
    </div>
  );
}

/**
 * Highlights a query substring in the rendered text. Case-insensitive
 * match; the highlight uses an amber-tinted background so it lines up
 * with the brand without overwhelming the row.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const ql = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lower.indexOf(ql, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={idx}
        style={{
          backgroundColor: "rgba(232,134,12,0.18)",
          color: "inherit",
          borderRadius: 3,
          padding: "0 2px",
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    cursor = idx + q.length;
  }
  return <>{parts}</>;
}
