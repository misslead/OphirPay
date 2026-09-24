// SPDX-License-Identifier: MIT

/**
 * Issue #786 — every data-backed route has a page-shaped loading boundary.
 *
 * Twenty-odd routes fetch from the API, but only the root and /payments had a
 * `loading.tsx`, so the rest fell through to the root spinner or to nothing while
 * their data resolved — visible as layout shift and a placeholder that does not
 * look like the page that is coming.
 *
 * The rule here is derived from the sources rather than a hand-kept list: a route
 * is "data-backed" when its directory mentions an API endpoint (`/api/...`), and
 * it must then own a `loading.tsx` that draws one of the Skeleton primitives. A
 * new page that calls the API without a boundary fails this suite, and a boundary
 * left behind by a deleted page fails it too.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const APP_DIR = join(root, "src", "app");
const read = (absPath: string): string => readFileSync(absPath, "utf8");

/** Every page route (relative to src/app), excluding the API tree. */
function pageRoutes(): string[] {
  const entries = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.replace(/\\/g, "/"))
    .filter((entry) => entry === "page.tsx" || entry.endsWith("/page.tsx"));

  return entries
    .map((entry) => entry.replace(/\/?page\.tsx$/, ""))
    .filter((rel) => rel !== "" && !rel.startsWith("api") && !rel.split("/").includes("api"));
}

/** All TypeScript in a route directory, so child components count as the route. */
function routeSource(rel: string): string {
  const dir = join(APP_DIR, ...rel.split("/"));
  let blob = "";
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) blob += read(full) + "\n";
    }
  };
  walk(dir);
  return blob;
}

const DATA_BACKED = pageRoutes().filter((rel) => routeSource(rel).includes("/api/"));

describe("route-level loading boundaries (#786)", () => {
  it("finds the data-backed routes it is meant to cover", () => {
    // A sanity floor: if the detector stops matching, this suite would otherwise
    // pass by covering nothing.
    expect(DATA_BACKED.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every data-backed route its own loading boundary", () => {
    const missing = DATA_BACKED.filter(
      (rel) => !existsSync(join(APP_DIR, ...rel.split("/"), "loading.tsx")),
    );

    expect(missing, `routes without loading.tsx: ${missing.join(", ")}`).toEqual([]);
  });

  it("draws each boundary with the Skeleton primitives, not a bare spinner", () => {
    for (const rel of DATA_BACKED) {
      const loading = read(join(APP_DIR, ...rel.split("/"), "loading.tsx"));
      expect(loading, `${rel}/loading.tsx should use the Skeleton primitives`).toMatch(
        /LoadingSkeleton|from "@\/components\/ui\/Skeleton"/,
      );
      expect(loading, `${rel}/loading.tsx should be a page-shaped placeholder`).toMatch(
        /variant="(table|card|stats|text)"/,
      );
    }
  });

  it("does not keep a boundary for a page that no longer exists", () => {
    const loadingFiles = readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
      .map((entry) => entry.replace(/\\/g, "/"))
      .filter((entry) => entry.endsWith("loading.tsx"));

    const orphans = loadingFiles.filter((entry) => {
      const dir = entry.replace(/\/?loading\.tsx$/, "");
      if (dir === "") return false; // the root boundary belongs to the layout
      const parent = join(APP_DIR, ...dir.split("/"));
      return statSync(parent).isDirectory() && !existsSync(join(parent, "page.tsx")) && !existsSync(join(parent, "layout.tsx"));
    });

    expect(orphans, `loading boundaries without a page: ${orphans.join(", ")}`).toEqual([]);
  });
});
