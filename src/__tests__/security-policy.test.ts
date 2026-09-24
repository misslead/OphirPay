// SPDX-License-Identifier: MIT

/**
 * Issue #765 — the middleware security policy is data, not template strings.
 *
 * `src/proxy.ts` used to build the CSP, the rate-limit defaults and the
 * client-IP precedence inline. The policy now lives in
 * `src/lib/security-policy.ts` and the middleware only assembles it.
 *
 * The assertion that matters is the exact directive set below: it is written
 * out in full, so adding or removing an allow-listed host fails this test until
 * the policy is updated deliberately rather than by accident.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLIENT_IP_HEADER_PRECEDENCE,
  CSP_DIRECTIVES,
  RATE_LIMIT_DEFAULTS,
  buildCspHeader,
  clientIpFromHeaders,
  rateLimitMax,
  rateLimitWindowMs,
  resolveCspDirectives,
} from "@/lib/security-policy";

/** The complete production policy: one entry per directive, values in order. */
const PRODUCTION_POLICY: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "connect-src": [
    "'self'",
    "https://horizon-testnet.stellar.org",
    "https://horizon.stellar.org",
    "https://soroban-testnet.stellar.org",
    "https://soroban.stellar.org",
    "https://rpc-futurenet.stellar.org",
    "https://mainnet.soroban.rpc.pulse.so",
  ],
  "img-src": [
    "'self'",
    "data:",
    "https://stellar.expert",
    "https://raw.githubusercontent.com",
  ],
  "font-src": ["'self'"],
  "frame-src": [
    "'self'",
    "https://*.freighter.app",
    "chrome-extension:",
    "moz-extension:",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
};

const asRecord = (
  directives: { name: string; values: string[] }[],
): Record<string, string[]> =>
  Object.fromEntries(directives.map((d) => [d.name, d.values]));

describe("CSP directive set (#765)", () => {
  it("matches the production policy exactly", () => {
    expect(asRecord(resolveCspDirectives(true))).toEqual(PRODUCTION_POLICY);
  });

  it("declares each directive once, in the asserted order", () => {
    expect(resolveCspDirectives(true).map((d) => d.name)).toEqual(
      Object.keys(PRODUCTION_POLICY),
    );
  });

  it("only widens script-src outside production", () => {
    const dev = asRecord(resolveCspDirectives(false));
    expect(dev["script-src"]).toContain("'unsafe-eval'");
    for (const [name, values] of Object.entries(PRODUCTION_POLICY)) {
      if (name === "script-src") continue;
      expect(dev[name]).toEqual(values);
    }
  });

  it("serialises every directive exactly once", () => {
    const expected = Object.entries(PRODUCTION_POLICY)
      .map(([name, values]) => [name, ...values].join(" "))
      .join("; ");

    expect(buildCspHeader(true)).toBe(expected);
    expect(buildCspHeader(true)).toContain("connect-src 'self' https://horizon");
  });

  it("keeps every host in the data, not in a template string", () => {
    const hosts = CSP_DIRECTIVES.flatMap((d) => d.values).filter((v) =>
      v.startsWith("https://"),
    );

    expect(hosts).toEqual(
      expect.arrayContaining([
        "https://horizon.stellar.org",
        "https://soroban.stellar.org",
        "https://mainnet.soroban.rpc.pulse.so",
      ]),
    );
  });
});

describe("rate-limit policy defaults (#765)", () => {
  it("defaults to 120 requests per 60s window", () => {
    expect(rateLimitWindowMs()).toBe(60_000);
    expect(RATE_LIMIT_DEFAULTS.requestsPerMinute).toBe(120);
    expect(rateLimitMax({})).toBe(120);
  });

  it("honours RATE_LIMIT_RPM", () => {
    expect(rateLimitMax({ RATE_LIMIT_RPM: "30" })).toBe(30);
  });

  it("falls back to the default on unusable values", () => {
    expect(rateLimitMax({ RATE_LIMIT_RPM: "" })).toBe(120);
    expect(rateLimitMax({ RATE_LIMIT_RPM: "0" })).toBe(120);
    expect(rateLimitMax({ RATE_LIMIT_RPM: "nonsense" })).toBe(120);
  });

  it("never returns less than one request", () => {
    expect(rateLimitMax({ RATE_LIMIT_RPM: "-10" })).toBe(1);
  });
});

describe("client IP precedence (#765)", () => {
  it("is declared as ordered data", () => {
    expect(CLIENT_IP_HEADER_PRECEDENCE.map((entry) => entry.header)).toEqual([
      "x-forwarded-for",
      "x-real-ip",
    ]);
  });

  it("takes the first entry of x-forwarded-for", () => {
    const headers: Record<string, string> = {
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
    };
    expect(clientIpFromHeaders((h) => headers[h] ?? null)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to unknown", () => {
    expect(clientIpFromHeaders((h) => (h === "x-real-ip" ? "198.51.100.4" : null))).toBe(
      "198.51.100.4",
    );
    expect(clientIpFromHeaders(() => null)).toBe("unknown");
    expect(clientIpFromHeaders(() => "")).toBe("unknown");
  });
});

describe("src/proxy.ts holds no policy literals (#765)", () => {
  const source = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

  it("imports the policy module", () => {
    expect(source).toContain("@/lib/security-policy");
  });

  it("names no CSP directive", () => {
    for (const name of Object.keys(PRODUCTION_POLICY)) {
      expect(source).not.toContain(name);
    }
  });

  it("hard-codes no allow-listed host, extension scheme or client-IP header", () => {
    expect(source).not.toMatch(/stellar\.org|freighter\.app|pulse\.so/);
    expect(source).not.toMatch(/chrome-extension:|moz-extension:/);
    expect(source).not.toMatch(/x-forwarded-for|x-real-ip/);
  });

  it("hard-codes no rate-limit window", () => {
    expect(source).not.toContain("60_000");
  });
});
