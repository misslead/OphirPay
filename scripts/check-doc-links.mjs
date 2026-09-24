#!/usr/bin/env node
/**
 * check-doc-links.mjs — keep the documentation's links honest (issue #769).
 *
 * The repository ships roughly fifty markdown files (docs/, the translated
 * READMEs, examples/, the audit reports). Nothing checks their links, so a
 * heading gets renamed and the table of contents silently starts pointing at a
 * dead anchor, or a path moves and a "see also" link 404s — invisible until a
 * reader hits it.
 *
 *   node scripts/check-doc-links.mjs              # check every markdown file
 *   node scripts/check-doc-links.mjs --list       # print the files it checks
 *   node scripts/check-doc-links.mjs --external   # also probe external URLs (warnings only)
 *   node scripts/check-doc-links.mjs --strict-external  # make external failures fatal
 *
 * Internal failures (a missing file, a missing anchor) exit 1 and are reported
 * as `path:line: what`. External URLs are warnings by default: the network is
 * not a build input, hosts rate-limit automation, and pre-existing external rot
 * should not block an unrelated pull request.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "test-results",
]);

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const EXTERNAL = /^https?:\/\//i;
const IGNORED_SCHEMES = /^(mailto:|tel:|data:)/i;

const args = process.argv.slice(2);
const listOnly = args.includes("--list");
const checkExternal = args.includes("--external") || args.includes("--strict-external");
const strictExternal = args.includes("--strict-external");

/** Every markdown file in the repository, sorted, repo-relative with `/`. */
function markdownFiles(dir = repoRoot, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      markdownFiles(join(dir, entry.name), found);
      continue;
    }
    if (extname(entry.name) !== ".md") continue;
    found.push(join(dir, entry.name).slice(repoRoot.length + 1).split(sep).join("/"));
  }
  return found.sort();
}

/**
 * GitHub's heading anchor: lowercase, drop HTML, drop everything that is not a
 * letter, number, space, hyphen or underscore (which removes emoji and
 * punctuation), then spaces become hyphens. Repeated headings get -1, -2, ...
 */
function slugify(heading) {
  // Same rule as github-slugger: drop everything that is not a letter, a
  // combining mark, a number, an underscore, a hyphen or a space — which keeps
  // emoji variation selectors (U+FE0F) that GitHub keeps, and leaves the
  // hyphens inside a heading's own text alone — then turn every single space
  // into its own hyphen, so "a & b" keeps the two the ampersand left behind.
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, "")
    .replace(/ /g, "-");
}

/** Every anchor a file offers, including GitHub's duplicate-heading suffixes. */
function anchorsOf(text) {
  const counts = new Map();
  const anchors = new Set();
  for (const line of text.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.*?)\s*$/);
    if (!heading) continue;
    const base = slugify(heading[1]);
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
  }
  return anchors;
}

/** Links in a file: inline `[text](target)`, images, and reference definitions. */
function linksOf(text) {
  const links = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const inline = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
    for (const match of line.matchAll(inline)) {
      links.push({ target: match[1], line: index + 1 });
    }
    const definition = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(line);
    if (definition) links.push({ target: definition[1], line: index + 1 });
  });

  return links;
}

const files = markdownFiles();

if (listOnly) {
  process.stdout.write(`${JSON.stringify(files)}\n`);
  process.exit(0);
}

const contents = new Map(files.map((file) => [file, readFileSync(join(repoRoot, file), "utf8")]));
const anchorCache = new Map();
const anchorsFor = (file) => {
  if (!anchorCache.has(file)) anchorCache.set(file, anchorsOf(contents.get(file) ?? ""));
  return anchorCache.get(file);
};

const failures = [];
const warnings = [];
const external = new Map();

for (const file of files) {
  const text = contents.get(file);

  for (const { target, line } of linksOf(text)) {
    if (SCHEME.test(target) && !EXTERNAL.test(target)) {
      if (!IGNORED_SCHEMES.test(target)) warnings.push(`${file}:${line}: unsupported scheme: ${target}`);
      continue;
    }

    if (EXTERNAL.test(target)) {
      external.set(target, (external.get(target) ?? 0) + 1);
      continue;
    }

    if (target.startsWith("/")) {
      warnings.push(`${file}:${line}: site-absolute path cannot be checked from the repository: ${target}`);
      continue;
    }

    const [path, fragment] = target.split("#");
    const at = `${file}:${line}`;

    if (path === "") {
      if (fragment && !anchorsFor(file).has(decodeURIComponent(fragment))) {
        failures.push(`${at}: no heading in this file matches #${fragment}`);
      }
      continue;
    }

    const targetPath = resolve(dirname(join(repoRoot, file)), decodeURIComponent(path));
    const relative = targetPath.slice(repoRoot.length + 1).split(sep).join("/");

    let stats;
    try {
      stats = statSync(targetPath);
    } catch {
      failures.push(`${at}: ${path} does not exist (expected ${relative})`);
      continue;
    }

    if (stats.isDirectory()) {
      if (!statSync(targetPath).isDirectory() || !readdirSync(targetPath).length) {
        failures.push(`${at}: ${path} is an empty directory`);
      }
      continue;
    }

    if (fragment && relative.endsWith(".md")) {
      const targetText = contents.get(relative) ?? readFileSync(targetPath, "utf8");
      const anchors = contents.has(relative) ? anchorsFor(relative) : anchorsOf(targetText);
      if (!anchors.has(decodeURIComponent(fragment))) {
        failures.push(`${at}: ${path} has no heading that matches #${fragment}`);
      }
    }
  }
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    if (response.status >= 400) return `HTTP ${response.status}`;
    return null;
  } catch (error) {
    return error.name === "AbortError" ? "timed out" : String(error.cause?.code ?? error.message);
  } finally {
    clearTimeout(timer);
  }
}

if (checkExternal && external.size > 0) {
  for (const url of [...external.keys()].sort()) {
    const problem = await probe(url);
    if (problem) {
      const message = `external link not verified: ${url} (${problem})`;
      if (strictExternal) failures.push(message);
      else warnings.push(message);
    }
  }
}

for (const warning of warnings) console.warn(`warn  ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  console.error(
    `\n${failures.length} broken internal link(s) across ${files.length} markdown file(s). ` +
      `External URLs: ${external.size} (${checkExternal ? "probed" : "not probed; pass --external to warn on them"}).`,
  );
  process.exit(1);
}

console.log(
  `ok    ${files.length} markdown file(s): every internal link and anchor resolves ` +
    `(${external.size} external URL(s) ${checkExternal ? "probed" : "skipped"}).`,
);
