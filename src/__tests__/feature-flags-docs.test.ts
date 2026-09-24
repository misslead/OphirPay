// SPDX-License-Identifier: MIT

/**
 * Issue #771 — the flag matrix must describe the flags that exist.
 *
 * The matrix in `docs/FEATURE_FLAGS.md` is only useful if it cannot drift from
 * `src/lib/feature-flags.ts`: a flag added to the module without a row, a row
 * for a flag that no longer exists, an environment variable that is not in
 * `.env.example`, and — the part that rots first — a "gates today" column that
 * still says "none" after a flag gained its first consumer.
 *
 * Each assertion below turns one of those silent drifts into a loud failure.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const root = process.cwd();
const read = (relPath: string): string => readFileSync(join(root, relPath), "utf8");

const DOC_PATH = "docs/FEATURE_FLAGS.md";
const MODULE_PATH = "src/lib/feature-flags.ts";
const ENV_EXAMPLE_PATH = ".env.example";

const declaredFlags = Object.keys(FEATURE_FLAGS);

/**
 * `| \`MULTI_ASSET\` | NEXT_PUBLIC_FEATURE_MULTI_ASSET | ... |` rows of the
 * matrix. The header and separator rows are skipped by requiring the first
 * cell to be a backticked flag name.
 */
function matrixRows(): string[][] {
  return read(DOC_PATH)
    .split("\n")
    .filter((line) => line.trim().startsWith("|"))
    .map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 5 && /^`[A-Z_]+`$/.test(cells[0]));
}

function rowFor(flag: string): string[] | undefined {
  return matrixRows().find((cells) => cells[0] === `\`${flag}\``);
}

/** Every source file outside the test tree. */
function sourceFiles(): string[] {
  return readdirSync(join(root, "src"), { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replace(/\\/g, "/"))
    .filter((entry) => entry.endsWith(".ts") || entry.endsWith(".tsx"))
    .filter((entry) => !entry.includes("__tests__"))
    .map((entry) => `src/${entry}`);
}

/** Files that call `isFeatureEnabled("<flag>")`, i.e. the flag's real consumers. */
function consumersOf(flag: string): string[] {
  const pattern = new RegExp(`isFeatureEnabled\\(\\s*["'\`]${flag}["'\`]`);
  return sourceFiles().filter((file) => pattern.test(read(file)));
}

describe("feature flag matrix (docs/FEATURE_FLAGS.md) — #771", () => {
  it("documents every flag declared in the module", () => {
    for (const flag of declaredFlags) {
      expect(rowFor(flag), `${flag} has no row in the matrix`).toBeDefined();
    }
  });

  it("documents no flag the module does not declare", () => {
    const documented = matrixRows().map((cells) => cells[0].replace(/`/g, ""));
    for (const flag of documented) {
      expect(declaredFlags, `${flag} is documented but not declared`).toContain(flag);
    }
  });

  it("names the environment variable the module actually reads", () => {
    const source = read(MODULE_PATH);
    for (const flag of declaredFlags) {
      const match = source.match(
        new RegExp(`${flag}:\\s*process\\.env\\.(NEXT_PUBLIC_[A-Z0-9_]+)`),
      );
      expect(match, `${flag} does not read a NEXT_PUBLIC_ variable`).toBeTruthy();
      expect(rowFor(flag)?.[1]).toContain(match![1]);
    }
  });

  it("describes the default with the same polarity as the module", () => {
    const source = read(MODULE_PATH);
    const rows = matrixRows();
    for (const flag of declaredFlags) {
      const line = source
        .split("\n")
        .find((candidate) => candidate.trim().startsWith(`${flag}:`));
      expect(line, `${flag} has no entry`).toBeTruthy();
      const enabledByDefault = !line!.includes('=== "true"');
      const cells = rows
        .find((candidate) => candidate[0] === `\`${flag}\``)!;
      const defaultColumn = cells[2].toLowerCase();
      if (enabledByDefault) {
        expect(defaultColumn, `${flag} is on by default`).toContain("on —");
      } else {
        expect(defaultColumn, `${flag} is off by default`).toContain("**off");
      }
    }
  });

  it("lists every flag variable in .env.example", () => {
    const envExample = read(ENV_EXAMPLE_PATH);
    for (const flag of declaredFlags) {
      const match = read(MODULE_PATH).match(
        new RegExp(`${flag}:\\s*process\\.env\\.(NEXT_PUBLIC_[A-Z0-9_]+)`),
      );
      expect(envExample, `${match?.[1]} is missing from .env.example`).toContain(match![1]);
    }
  });

  it("documents the dev-only override and its key prefix", () => {
    const doc = read(DOC_PATH);
    expect(doc).toContain(`ff_`);
    expect(doc).toContain("STORAGE_KEYS.FEATURE_FLAG_PREFIX");
    expect(doc.toLowerCase()).toContain("development-only");
    expect(STORAGE_KEYS.FEATURE_FLAG_PREFIX).toBe("ff_");
  });

  it("documents that NEXT_PUBLIC_* values are inlined at build time", () => {
    const doc = read(DOC_PATH);
    expect(doc).toContain("inlines");
    expect(doc).toContain("rebuild");
  });

  it("keeps the 'gates today' column in step with the real consumers", () => {
    for (const flag of declaredFlags) {
      const consumers = consumersOf(flag);
      const gatesColumn = rowFor(flag)![4];
      if (consumers.length === 0) {
        expect(gatesColumn, `${flag} claims consumers that do not exist`).toContain("none");
      } else {
        for (const consumer of consumers) {
          expect(gatesColumn, `${flag} does not document ${consumer}`).toContain(consumer);
        }
      }
    }
  });
});
