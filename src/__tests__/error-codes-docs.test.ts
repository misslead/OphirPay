// SPDX-License-Identifier: MIT

/**
 * Issue #778 — the error-code table must describe the catalog that exists.
 *
 * `docs/ERROR_CODES.md` is generated from `src/lib/error-codes.ts` (the codes,
 * grouped by the HTTP status of their section) and `src/lib/error-messages.ts`
 * (the user-facing messages). Without this test the page rots silently: a code
 * added to the catalog simply does not appear, and a code whose message changes
 * keeps advertising the old text.
 *
 * Regenerate with: `node scripts/generate-error-code-docs.mjs`
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ERROR_CODES } from "@/lib/error-codes";
import { ERRORS } from "@/lib/error-messages";

const root = process.cwd();
const read = (relPath: string): string => readFileSync(join(root, relPath), "utf8");

const DOC_PATH = "docs/ERROR_CODES.md";
const CATALOG_PATH = "src/lib/error-codes.ts";

/** Code -> the HTTP status of the section it is declared in. */
function catalogStatuses(): Record<string, number> {
  const statuses: Record<string, number> = {};
  let current: number | null = null;

  for (const line of read(CATALOG_PATH).split(/\r?\n/)) {
    const banner = line.match(/^\s*\/\/\s*(\d{3})\s*[—-]\s*.+$/);
    if (banner) {
      current = Number(banner[1]);
      continue;
    }
    const entry = line.match(/^\s*([A-Z][A-Z0-9_]*):\s*"([A-Z0-9_]+)",?$/);
    if (entry && current !== null) statuses[entry[1]] = current;
  }

  return statuses;
}

interface DocSection {
  status: number;
  retryable: string | null;
  rows: { code: string; message: string }[];
}

/** The per-status sections of the generated table. */
function docSections(): DocSection[] {
  const sections: DocSection[] = [];
  let current: DocSection | null = null;

  for (const line of read(DOC_PATH).split(/\r?\n/)) {
    const heading = line.match(/^###\s+(\d{3})\s+—\s+.+$/);
    if (heading) {
      current = { status: Number(heading[1]), retryable: null, rows: [] };
      sections.push(current);
      continue;
    }
    if (!current) continue;

    const retryable = line.match(/^Retryable:\s+(yes|no)\s*$/);
    if (retryable) {
      current.retryable = retryable[1];
      continue;
    }

    const row = line.match(/^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*$/);
    if (row) current.rows.push({ code: row[1], message: row[3] });
  }

  return sections;
}

/** The statuses the document declares as retryable. */
function documentedRetryableStatuses(): number[] {
  const line = read(DOC_PATH)
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith("Retryable statuses:"));
  expect(line, "the document must declare its retryable statuses").toBeTruthy();
  return (line!.match(/\d{3}/g) ?? []).map(Number);
}

const sections = docSections();
const documentedCodes = sections.flatMap((section) => section.rows.map((row) => row.code));

describe("error-code table (docs/ERROR_CODES.md) — #778", () => {
  it("documents every code in the catalog exactly once", () => {
    const declared = Object.keys(ERROR_CODES);
    expect([...documentedCodes].sort()).toEqual([...declared].sort());
    expect(new Set(documentedCodes).size).toBe(documentedCodes.length);
  });

  it("groups each code under the status its catalog section declares", () => {
    const statuses = catalogStatuses();
    for (const section of sections) {
      for (const row of section.rows) {
        expect(statuses[row.code], `${row.code} is missing from the catalog`).toBe(
          section.status,
        );
      }
    }
  });

  it("marks a section retryable exactly when its status is a retryable status", () => {
    const retryable = documentedRetryableStatuses();
    for (const section of sections) {
      const expected = retryable.includes(section.status) ? "yes" : "no";
      expect(section.retryable, `${section.status} is marked ${section.retryable}`).toBe(
        expected,
      );
    }
  });

  it("repeats the catalogued user-facing message, and only where one exists", () => {
    for (const section of sections) {
      for (const row of section.rows) {
        const catalogued = (ERRORS as Record<string, unknown>)[row.code];
        if (typeof catalogued === "string") {
          expect(row.message, `${row.code} message drifted`).toBe(catalogued);
        } else {
          expect(row.message, `${row.code} should not advertise a message`).toBe("—");
        }
      }
    }
  });

  it("points contract reverts at the separate contract-error catalog", () => {
    const doc = read(DOC_PATH);
    expect(doc).toContain("contract-errors.ts");
    expect(doc).toContain("CONTRACT_ERROR");
  });
});
