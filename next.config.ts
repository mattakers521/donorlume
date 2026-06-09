import type { NextConfig } from "next";

/**
 * Security headers applied to every response. Kept in a single
 * exported list so the rationale lives next to the policy.
 *
 * CSP notes:
 *   - `'self'` plus inline allowances cover Next.js's hydration script
 *     + design-token inline styles. Hashing every inline block in this
 *     codebase is impractical without a build-step transformer; we
 *     accept `'unsafe-inline'` for styles + scripts and rely on the
 *     other CSP directives (default-src 'self', frame-ancestors
 *     'none') for the meaningful clickjacking + lateral-movement
 *     defenses.
 *   - `connect-src` includes the third parties we POST to from the
 *     browser: Resend (tracking pixel callbacks), Stripe Checkout
 *     iframe + JS bundle, Anthropic streaming responses, ProPublica.
 *   - `frame-ancestors 'none'` is redundant with X-Frame-Options DENY
 *     for modern browsers but covers IE / older clients that ignore
 *     the CSP directive.
 */
const securityHeaders = [
  // Strict-Transport-Security — force HTTPS for 2 years incl. subdomains
  // + preload eligibility. Once we're on a real domain in prod, submit
  // to hstspreload.org.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking — defense in depth (CSP frame-ancestors below).
  { key: "X-Frame-Options", value: "DENY" },
  // MIME sniffing — disable browser's content-type guessing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer leakage — only send origin on cross-origin nav.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down sensitive browser APIs we don't use.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js hydration + inline event handlers in some lucide-react
      // components require unsafe-inline for scripts; Stripe loads
      // their checkout JS from js.stripe.com.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      // Inline styles for design tokens + lucide SVG attributes.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Outbound XHR + fetch + streaming.
      "connect-src 'self' https://api.stripe.com https://api.resend.com https://api.anthropic.com https://projects.propublica.org",
      // Embedded iframes: Stripe Checkout.
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
