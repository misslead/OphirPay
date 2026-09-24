// SPDX-License-Identifier: MIT

/**
 * Issue #773 — docs/ESCROWS_AND_STREAMS.md must describe what the routes do.
 *
 * The escrow and stream APIs have no UI, so the document is the only description
 * an integrator gets. This pins it to the sources: the four route files, the
 * error catalogue, the contract's numeric codes, and the claim that no UI exists.
 * A route that grows a method, an error code that disappears, or a dashboard that
 * finally ships all fail here until the page is updated.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (relPath: string): string => readFileSync(join(root, relPath), "utf8");

const DOC = "docs/ESCROWS_AND_STREAMS.md";
const ROUTES = [
  "src/app/api/escrows/route.ts",
  "src/app/api/escrows/[id]/route.ts",
  "src/app/api/streams/route.ts",
  "src/app/api/streams/[id]/route.ts",
];

/** Non-test app directories that mention escrows or streams (a UI would live here). */
function uiDirectories(): string[] {
  const appDir = join(root, "src", "app");
  return readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replace(/\\/g, "/"))
    .filter((entry) => /(^|\/)(escrows?|streams?)($|\/)/.test(entry))
    .filter((entry) => !entry.startsWith("api/"));
}

describe("escrow and stream API documentation (#773)", () => {
  const doc = read(DOC);

  it("documents every route the four handlers expose", () => {
    for (const route of ROUTES) {
      expect(existsSync(join(root, route)), `${route} is missing`).toBe(true);
      const source = read(route);
      const path = "/" + route.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "");
      // The documented path uses `{id}` where the file uses `[id]`.
      const documented = path.replace("[id]", "{id}");
      expect(doc, `${documented} is not documented`).toContain(documented);

      for (const method of ["GET", "POST"] as const) {
        if (source.includes(`export const ${method}`)) {
          expect(doc, `${method} ${documented} is not documented`).toContain(`\`${method}\``);
        }
      }
    }
  });

  it("says the POSTs hand off to client-side signing, as the 202 does", () => {
    for (const route of ["src/app/api/escrows/route.ts", "src/app/api/streams/route.ts"]) {
      expect(read(route)).toContain("202");
    }
    expect(doc).toMatch(/202/);
    expect(doc).toMatch(/client-side signing|client-side createEscrow|client-side createStream/);
  });

  it("documents error codes that exist in the API catalogue", () => {
    const catalogue = read("src/lib/error-codes.ts");
    const documented = [...doc.matchAll(/`([A-Z][A-Z0-9_]{4,})`/g)].map((match) => match[1]);
    const apiCodes = documented.filter((code) =>
      ["ESCROW_", "STREAM_", "VALIDATION_", "UNAUTHORIZED", "CONTRACT_ERROR"].some((prefix) =>
        code.startsWith(prefix),
      ),
    );

    expect(new Set(apiCodes).size).toBeGreaterThanOrEqual(8);
    for (const code of new Set(apiCodes)) {
      expect(catalogue, `${code} is not in the error catalogue`).toContain(`${code}:`);
    }
  });

  it("names the contract functions each endpoint is built on", () => {
    const contract = read("contracts/ophirpay/src/lib.rs");
    for (const fn of [
      "create_escrow",
      "release_escrow",
      "release_by_arbiter",
      "claim_escrow",
      "create_stream",
      "claim_stream",
      "cancel_stream",
    ]) {
      expect(contract, `${fn} is no longer in the contract`).toContain(`fn ${fn}(`);
      expect(doc, `${fn} is not documented`).toContain(fn);
    }
  });

  it("states that there is no UI, and fails once one ships", () => {
    expect(doc).toMatch(/no UI/i);

    if (uiDirectories().length > 0) {
      throw new Error(
        `A dashboard for escrows or streams now exists (${uiDirectories().join(", ")}): ` +
          "docs/ESCROWS_AND_STREAMS.md says there is none, so update the page.",
      );
    }
  });

  it("is linked from the README and the function reference", () => {
    expect(read("README.md")).toContain("docs/ESCROWS_AND_STREAMS.md");
    expect(read("docs/CONTRACT_FUNCTION_REFERENCE.md")).toContain("ESCROWS_AND_STREAMS.md");
  });
});
