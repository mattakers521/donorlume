"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { C } from "@/lib/design";
import {
  MAX_FOCUS_AREAS,
  MAX_FOCUS_AREA_LENGTH,
  normalizeFocusAreas,
} from "@/lib/org-profile";
import {
  helpStyle,
  inputBase,
  labelStyle,
} from "@/components/settings/settings-form";

/**
 * Tag-style input for Organization.focusAreas. Type a focus area and
 * press Enter (or a comma) to add it; click × to remove. Submits as a
 * single newline-joined hidden field — the server action re-normalizes
 * it, so a pending un-committed entry still saves.
 */
export function FocusAreasInput({
  name,
  label,
  help,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  help?: string;
  defaultValue: string[];
  placeholder?: string;
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");
  const atLimit = tags.length >= MAX_FOCUS_AREAS;

  const commit = (text: string) => {
    if (!text.trim()) return;
    setTags((current) => normalizeFocusAreas([...current, ...text.split(",")]));
    setDraft("");
  };

  const remove = (tag: string) =>
    setTags((current) => current.filter((t) => t !== tag));

  const submitted = normalizeFocusAreas([...tags, draft]).join("\n");

  return (
    <div>
      <label htmlFor={`${name}-entry`} style={labelStyle}>
        {label}
      </label>
      <div
        style={{
          ...inputBase,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          minHeight: 48,
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            data-testid="focus-area-tag"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 6px 5px 12px",
              borderRadius: 999,
              backgroundColor: C.amberLight,
              color: C.amberDark,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 20,
                height: 20,
                borderRadius: 999,
                border: "none",
                background: "rgba(194,106,0,0.12)",
                color: C.amberDark,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          id={`${name}-entry`}
          value={draft}
          disabled={atLimit}
          maxLength={MAX_FOCUS_AREA_LENGTH}
          placeholder={
            atLimit
              ? `Up to ${MAX_FOCUS_AREAS} focus areas`
              : tags.length === 0
                ? placeholder
                : "Add another…"
          }
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(",")) commit(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Enter adds a tag instead of submitting the whole form.
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && !draft && tags.length > 0) {
              setTags((current) => current.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
          style={{
            flex: "1 1 140px",
            minWidth: 120,
            border: "none",
            outline: "none",
            fontSize: 14.5,
            color: C.text,
            background: "transparent",
            fontFamily: "var(--font-jakarta), sans-serif",
            padding: "4px 2px",
          }}
        />
      </div>
      <input type="hidden" name={name} value={submitted} />
      {help && <div style={helpStyle}>{help}</div>}
    </div>
  );
}
