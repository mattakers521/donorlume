"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Loader as LoaderIcon,
  Mail,
} from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";

type FormState =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "error"; message: string };

export function LandingContact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setState({ kind: "idle" });
    startTransition(async () => {
      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, organization, message }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !body.ok) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setState({ kind: "ok" });
        setName("");
        setEmail("");
        setOrganization("");
        setMessage("");
      } catch (e) {
        setState({
          kind: "error",
          message:
            e instanceof Error
              ? e.message
              : "Couldn't send your message.",
        });
      }
    });
  };

  return (
    <section
      id="contact"
      style={{
        padding: "88px 24px",
        backgroundColor: C.surface,
        color: C.text,
      }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            className="landing-amber-rule"
            aria-hidden
            style={{ width: 80, margin: "0 auto 28px" }}
          />
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.amberDark,
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Get in Touch
          </div>
          <h2
            className="landing-section-h2"
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontWeight: 400,
              color: C.text,
              margin: "0 0 14px",
            }}
          >
            Let&rsquo;s talk about your fundraising.
          </h2>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: C.textBody,
              fontWeight: 500,
              margin: 0,
              maxWidth: 560,
              marginInline: "auto",
            }}
          >
            Send a note and we&rsquo;ll get back within one business day. If
            you&rsquo;d rather see the product in action, book a demo.
          </p>
        </div>

        {/* Form card */}
        <div
          style={{
            backgroundColor: C.bg,
            borderRadius: 22,
            padding: "clamp(24px, 3vw, 36px)",
            border: `1px solid ${C.border}`,
            boxShadow: shadow.md,
          }}
        >
          <form
            onSubmit={onSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div className="landing-grid-2">
              <Field
                label="Name"
                name="name"
                required
                value={name}
                onChange={setName}
                placeholder="Sarah Mitchell"
                autoComplete="name"
              />
              <Field
                label="Email"
                name="email"
                type="email"
                required
                value={email}
                onChange={setEmail}
                placeholder="sarah@yournonprofit.org"
                autoComplete="email"
              />
            </div>
            <Field
              label="Organization"
              name="organization"
              value={organization}
              onChange={setOrganization}
              placeholder="Hope Foundation"
              autoComplete="organization"
            />
            <Field
              label="Message"
              name="message"
              required
              value={message}
              onChange={setMessage}
              placeholder="Tell us what you're trying to accomplish — number of donors, CRM, current biggest fundraising challenge."
              multiline
            />

            {state.kind === "error" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 12,
                  backgroundColor: C.redLight,
                  color: C.red,
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                <AlertCircle size={16} />
                {state.message}
              </div>
            )}
            {state.kind === "ok" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 12,
                  backgroundColor: C.greenLight,
                  color: "#1B5E20",
                  fontSize: 13.5,
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} />
                Thanks — we&rsquo;ll be in touch within one business day.
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 4,
              }}
            >
              <button
                type="submit"
                disabled={pending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 26px",
                  borderRadius: 14,
                  background: brandGradient,
                  color: "#fff",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: pending ? "default" : "pointer",
                  opacity: pending ? 0.85 : 1,
                  boxShadow:
                    "0 10px 28px rgba(232,134,12,0.30), 0 3px 8px rgba(212,74,26,0.18)",
                  fontFamily: "var(--font-jakarta), sans-serif",
                }}
              >
                {pending ? (
                  <LoaderIcon size={16} className="spin" />
                ) : (
                  <ArrowRight size={16} />
                )}
                Send message
              </button>
            </div>
          </form>
        </div>

        {/* Email + Book a Demo footer row */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: C.textBody,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Mail size={15} color={C.amberDark} />
            Or email us at{" "}
            <a
              href="mailto:hello@donorlume.com"
              style={{
                color: C.amberDark,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              hello@donorlume.com
            </a>
          </div>
          <a
            href="mailto:hello@donorlume.com?subject=Book%20a%20demo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              borderRadius: 12,
              backgroundColor: "transparent",
              color: C.text,
              border: `1.5px solid ${C.text}`,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              fontFamily: "var(--font-jakarta), sans-serif",
            }}
          >
            <Calendar size={15} />
            Book a Demo
          </a>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  multiline,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: "text" | "email";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  autoComplete?: string;
}) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: `1.5px solid ${C.border}`,
    fontSize: 14.5,
    color: C.text,
    outline: "none",
    backgroundColor: C.surface,
    boxSizing: "border-box",
    fontFamily: "var(--font-jakarta), sans-serif",
    transition: "border-color 0.15s, box-shadow 0.15s",
  };
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = C.amber;
    e.currentTarget.style.boxShadow = "0 0 0 4px rgba(232,134,12,0.10)";
  };
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.currentTarget.style.borderColor = C.border;
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 800,
          color: C.textTertiary,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
        {required && (
          <span style={{ color: C.amberDark, marginLeft: 4 }}>*</span>
        )}
      </span>
      {multiline ? (
        <textarea
          name={name}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={5}
          style={{ ...baseStyle, resize: "vertical", minHeight: 120 }}
          onFocus={focus}
          onBlur={blur}
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={baseStyle}
          onFocus={focus}
          onBlur={blur}
        />
      )}
    </label>
  );
}
