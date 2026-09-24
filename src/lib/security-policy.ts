// SPDX-License-Identifier: MIT

/**
 * Security policy as data (issue #765).
 *
 * `src/proxy.ts` used to hold this policy inside its own bodies: the CSP
 * directive list, the rate-limit window and default, and the client-IP header
 * precedence were all inline. The CSP in particular is a policy that should be
 * reviewable as data — comparing the intended allow-list to what ships meant
 * reading a template string, and an allow-listed Stellar endpoint is exactly as
 * easy to miss in a string as it is in review.
 *
 * Everything here is plain data plus pure builders, so both `src/proxy.ts`
 * (Edge runtime) and the tests can import it without pulling in anything the
 * middleware bundle cannot run.
 */

/** Headers consulted for the client IP, in precedence order. */
export const CLIENT_IP_HEADER_PRECEDENCE = [
  { header: "x-forwarded-for", take: "first-entry" },
  { header: "x-real-ip", take: "whole-value" },
] as const;

/** Rate limiting defaults, overridable per deployment via env. */
export const RATE_LIMIT_DEFAULTS = {
  /** Sliding window length, in milliseconds. */
  windowMs: 60_000,
  /** Requests allowed per IP per window when RATE_LIMIT_RPM is unset. */
  requestsPerMinute: 120,
} as const;

export interface CspDirective {
  /** Directive name, e.g. `connect-src`. */
  name: string;
  /** Values sent in production. */
  values: string[];
  /** Replacement values outside production (HMR / Fast Refresh need eval). */
  developmentValues?: string[];
}

/**
 * Content-Security-Policy for HTML pages, one entry per directive.
 *
 * Next.js (App Router) injects inline streaming/hydration scripts, and this
 * Next 16 build does not propagate a per-request nonce (via `x-nonce` or a
 * request-header CSP) to the app renderer, so a `script-src` without
 * `'unsafe-inline'` blocks them and the app never hydrates. We therefore keep
 * `'unsafe-inline'` in `script-src` while every other directive stays strict
 * (`default-src 'self'`, `connect-src` allow-listed to Stellar endpoints only,
 * `frame-src` limited to wallet extensions, `object-src 'none'`, ...).
 * Development additionally needs `'unsafe-eval'` for HMR / Fast Refresh.
 */
export const CSP_DIRECTIVES: readonly CspDirective[] = [
  { name: "default-src", values: ["'self'"] },
  {
    name: "script-src",
    values: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"],
    developmentValues: [
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      "'wasm-unsafe-eval'",
    ],
  },
  { name: "style-src", values: ["'self'", "'unsafe-inline'"] },
  {
    name: "connect-src",
    values: [
      "'self'",
      // Horizon (testnet + mainnet)
      "https://horizon-testnet.stellar.org",
      "https://horizon.stellar.org",
      // Soroban RPC (testnet + mainnet + futurenet)
      "https://soroban-testnet.stellar.org",
      "https://soroban.stellar.org",
      "https://rpc-futurenet.stellar.org",
      // Third-party public RPC
      "https://mainnet.soroban.rpc.pulse.so",
    ],
  },
  {
    name: "img-src",
    values: [
      "'self'",
      "data:",
      "https://stellar.expert",
      "https://raw.githubusercontent.com",
    ],
  },
  { name: "font-src", values: ["'self'"] },
  {
    name: "frame-src",
    values: ["'self'", "https://*.freighter.app", "chrome-extension:", "moz-extension:"],
  },
  { name: "object-src", values: ["'none'"] },
  { name: "base-uri", values: ["'self'"] },
  { name: "form-action", values: ["'self'"] },
];

/** The directive set that applies in the given environment. */
export function resolveCspDirectives(isProduction: boolean): CspDirective[] {
  return CSP_DIRECTIVES.map((directive) => ({
    name: directive.name,
    values:
      !isProduction && directive.developmentValues
        ? [...directive.developmentValues]
        : [...directive.values],
  }));
}

/** Serialise the CSP into the header value `src/proxy.ts` sets. */
export function buildCspHeader(isProduction: boolean): string {
  return resolveCspDirectives(isProduction)
    .map((directive) => [directive.name, ...directive.values].join(" "))
    .join("; ");
}

/** Rate-limit window, in milliseconds. */
export function rateLimitWindowMs(): number {
  return RATE_LIMIT_DEFAULTS.windowMs;
}

/** Requests allowed per IP per window, honouring RATE_LIMIT_RPM. */
export function rateLimitMax(
  env: Record<string, string | undefined> = process.env,
): number {
  return Math.max(
    1,
    parseInt(env.RATE_LIMIT_RPM || String(RATE_LIMIT_DEFAULTS.requestsPerMinute), 10) ||
      RATE_LIMIT_DEFAULTS.requestsPerMinute,
  );
}

/** Resolve the client IP using the declared header precedence. */
export function clientIpFromHeaders(
  getHeader: (header: string) => string | null,
): string {
  for (const entry of CLIENT_IP_HEADER_PRECEDENCE) {
    const raw = getHeader(entry.header);
    if (!raw) continue;
    const candidate =
      entry.take === "first-entry" ? raw.split(",")[0]?.trim() : raw.trim();
    if (candidate) return candidate;
  }
  return "unknown";
}
