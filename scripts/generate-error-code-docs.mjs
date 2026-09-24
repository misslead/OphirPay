// SPDX-License-Identifier: MIT

/**
 * Regenerate docs/ERROR_CODES.md from the TypeScript catalogs (issue #778).
 *
 * Usage: node scripts/generate-error-code-docs.mjs
 *
 * The API error catalog lives in src/lib/error-codes.ts, grouped into
 * sections that are banner-commented with the HTTP status the codes in that
 * section are returned with. The user-facing messages that some of those codes
 * have live in src/lib/error-messages.ts.
 *
 * Reading both files keeps the table honest: a code added to the catalog shows
 * up here on the next run, and src/__tests__/error-codes-docs.test.ts fails
 * until the table is regenerated.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8");

const ERROR_CODES_PATH = "src/lib/error-codes.ts";
const ERROR_MESSAGES_PATH = "src/lib/error-messages.ts";
const DOC_PATH = "docs/ERROR_CODES.md";

/**
 * Statuses a client may retry. The list is written into the generated document
 * and is the single source of truth the drift test reads back.
 */
const RETRYABLE_STATUSES = [408, 425, 429, 500, 502, 503, 504];

/** Parse `// <status> — <category>` banners and the codes below each. */
function parseCatalog() {
  const sections = new Map();
  const order = [];
  let current = null;

  for (const line of read(ERROR_CODES_PATH).split(/\r?\n/)) {
    const banner = line.match(/^\s*\/\/\s*(\d{3})\s*[—-]\s*(.+?)\s*$/);
    if (banner) {
      current = { status: Number(banner[1]), category: banner[2] };
      if (!sections.has(current.status)) {
        sections.set(current.status, { ...current, codes: [] });
        order.push(current.status);
      }
      continue;
    }

    const entry = line.match(/^\s*([A-Z][A-Z0-9_]*):\s*"([A-Z0-9_]+)",?$/);
    if (entry && current) {
      sections.get(current.status).codes.push(entry[1]);
    }
  }

  return order.map((status) => sections.get(status));
}

/** The subset of the message catalog whose values are plain strings. */
function parseUserMessages() {
  const messages = {};
  const source = read(ERROR_MESSAGES_PATH);
  const pattern = /^\s{2}([A-Z][A-Z0-9_]*):\s*"((?:[^"\\]|\\.)*)",?\r?$/gm;
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const [, name, value] = match;
    const previous = source.slice(0, match.index);
    // Skip keys whose value is a function: they are templates, not messages.
    if (previous.trimEnd().endsWith("(")) continue;
    messages[name] = value.replace(/\\"/g, '"');
  }

  return messages;
}

/** `AMOUNT_TOO_SMALL` -> `Amount too small` */
function humanize(code) {
  const words = code.toLowerCase().split("_");
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ` ${words.slice(1).join(" ")}` : "");
}

function render(sections, messages) {
  const total = sections.reduce((sum, section) => sum + section.codes.length, 0);
  const statuses = sections.map((section) => section.status);
  const lines = [];

  lines.push("# API error codes");
  lines.push("");
  lines.push(
    "Every error response uses the same envelope, and the machine-readable part of it is `code`:",
  );
  lines.push("");
  lines.push("```json");
  lines.push('{ "success": false, "error": { "code": "INVALID_ADDRESS", "message": "…" } }');
  lines.push("```");
  lines.push("");
  lines.push(
    `The catalog in [\`src/lib/error-codes.ts\`](../src/lib/error-codes.ts) holds ${total} codes across ${sections.length} statuses. ` +
      "Match on `code` rather than on the message text: the message is for humans and may change, the code is the contract.",
  );
  lines.push("");
  lines.push("## Retryability");
  lines.push("");
  lines.push(
    `Retryable statuses: ${RETRYABLE_STATUSES.join(", ")}. Everything else in the catalog is terminal — ` +
      "retrying it will return the same answer, so surface the error instead.",
  );
  lines.push("");
  lines.push(
    "On `429`, honour the `Retry-After` response header: it carries the number of seconds until the window resets. " +
      "A `500` is retryable in the sense that the failure is not the request's fault, but only replay a request that is safe to repeat.",
  );
  lines.push("");
  lines.push(
    "## The user-facing message",
  );
  lines.push("");
  lines.push(
    "Some codes also have a catalogued, user-facing message in [`src/lib/error-messages.ts`](../src/lib/error-messages.ts); " +
      "where one exists the table repeats it below. The rest are returned with the message the route composes, `—` marks those.",
  );
  lines.push("");
  lines.push("## The catalog");
  lines.push("");
  lines.push(
    "Grouped by the HTTP status the codes in each section are returned with. The `Meaning` column is derived from the code name; " +
      "the authoritative contract is the code value and its status.",
  );

  for (const section of sections) {
    const retryable = RETRYABLE_STATUSES.includes(section.status) ? "yes" : "no";
    lines.push("");
    lines.push(`### ${section.status} — ${section.category}`);
    lines.push("");
    lines.push(`Retryable: ${retryable}`);
    lines.push("");
    lines.push("| Code | Meaning | User-facing message |");
    lines.push("|---|---|---|");

    for (const code of section.codes) {
      const message = messages[code] ? messages[code] : "—";
      lines.push(`| \`${code}\` | ${humanize(code)} | ${message} |`);
    }
  }

  lines.push("");
  lines.push("## Soroban contract errors");
  lines.push("");
  lines.push(
    "Reverts from the payment contract are not part of the catalog above. The contract's own numeric codes are decoded by " +
      "[`src/lib/contract-errors.ts`](../src/lib/contract-errors.ts) (`decodeContractError`, `getContractErrorCatalog`) and surface " +
      "through the API as `CONTRACT_ERROR`, keeping the transport-level status (`500` or `503`) unchanged.",
  );
  lines.push("");

  return lines.join("\n") + "\n";
}

const sections = parseCatalog();
writeFileSync(join(root, DOC_PATH), render(sections, parseUserMessages()), "utf8");
process.stdout.write(
  `${DOC_PATH}: ${sections.reduce((sum, s) => sum + s.codes.length, 0)} codes across ${sections.length} statuses\n`,
);
