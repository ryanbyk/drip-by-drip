/**
 * Fail when UI layout spacing uses a raw px length instead of a --space-* token.
 *
 * The scale is the distinct gap/padding steps in drip-by-drip.pen. Token names
 * are those pixel values (--space-12 is 12px). One-offs stay in px only with a
 * `spacing-allow` comment on the same line as the declaration.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PEN_SPACING_STEPS = [
  0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 40,
];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SPACING_PROP =
  /(?<![-\w])(padding(?:-(?:block-start|block-end|inline-start|inline-end|block|inline|top|right|bottom|left))?|margin(?:-(?:block-start|block-end|inline-start|inline-end|block|inline|top|right|bottom|left))?|row-gap|column-gap|gap|inset(?:-(?:block-start|block-end|inline-start|inline-end|block|inline))?|top|right|bottom|left)(?![\w-])\s*:/g;

const RAW_PX = /(?<![\w-])(-?(?:\d+\.\d+|\d+))px\b/g;
const SPACE_VAR = /var\(\s*--space-(\d+)\s*(?:,[^)]*)?\)/g;

const STYLE_KEYS =
  "padding|paddingTop|paddingRight|paddingBottom|paddingLeft|paddingBlock|paddingInline|margin|marginTop|marginRight|marginBottom|marginLeft|marginBlock|marginInline|gap|rowGap|columnGap|inset|top|right|bottom|left";

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

function blankComments(css) {
  const allowLines = new Set();
  let out = "";
  let i = 0;
  while (i < css.length) {
    if (css.startsWith("/*", i)) {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      const comment = css.slice(i, stop);
      if (comment.includes("spacing-allow")) {
        for (let line = lineAt(css, i); line <= lineAt(css, stop - 1); line += 1) allowLines.add(line);
      }
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    out += css[i];
    i += 1;
  }
  return { blanked: out, allowLines };
}

function readValue(css, start) {
  let i = start;
  let depth = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if ((ch === ";" || ch === "}") && depth === 0) break;
    i += 1;
  }
  return { value: css.slice(start, i), end: i };
}

export function parseSpaceTokens(css) {
  const root = css.match(/:root\s*\{([^}]*)\}/);
  const tokens = new Map();
  if (!root) return tokens;
  const re = /--space-(\d+)\s*:\s*([^;]+);/g;
  for (const match of root[1].matchAll(re)) {
    tokens.set(Number(match[1]), match[2].trim());
  }
  return tokens;
}

function push(errors, file, line, message) {
  errors.push({ file, line, message });
}

function auditCss(file, source, tokens, errors) {
  const { blanked, allowLines } = blankComments(source);
  const propRe = new RegExp(SPACING_PROP.source, "g");
  const pxRe = new RegExp(RAW_PX.source, "g");
  const tokenRe = new RegExp(SPACE_VAR.source, "g");
  let declarations = 0;
  for (const match of blanked.matchAll(propRe)) {
    const prop = match[1];
    const valueStart = match.index + match[0].length;
    const { value, end } = readValue(blanked, valueStart);
    const line = lineAt(source, match.index);
    const lineEnd = source.indexOf("\n", end);
    const sameLine = source.slice(match.index, lineEnd === -1 ? source.length : lineEnd);
    if (allowLines.has(line) || sameLine.includes("spacing-allow")) continue;
    declarations += 1;

    for (const px of value.matchAll(pxRe)) {
      const n = Number(px[1]);
      if (n === 0) continue;
      push(
        errors,
        file,
        line,
        `${prop} uses ${px[0]}. Use var(--space-${Number.isInteger(n) ? n : "*"}) from the pen scale, or mark a one-off with /* spacing-allow: reason */.`,
      );
    }

    for (const token of value.matchAll(tokenRe)) {
      const step = Number(token[1]);
      if (!tokens.has(step)) {
        push(errors, file, line, `${prop} uses var(--space-${step}), which is not a spacing token in :root.`);
      }
    }
  }
  return declarations;
}

function auditStyles(file, source, errors) {
  const styleRe = /style=\{\{([\s\S]*?)\}\}/g;
  const keyRe = new RegExp(`(?:^|[\\s{,])(${STYLE_KEYS})\\s*:\\s*(?:(["'\`])([\\s\\S]*?)\\2|(-?\\d+(?:\\.\\d+)?))`, "g");
  for (const block of source.matchAll(styleRe)) {
    const body = block[1];
    const base = block.index ?? 0;
    for (const match of body.matchAll(keyRe)) {
      const key = match[1];
      const literal = match[3];
      const number = match[4];
      const line = lineAt(source, base + (match.index ?? 0));
      const lineText = source.split("\n")[line - 1] ?? "";
      if (lineText.includes("spacing-allow")) continue;
      if (literal && RAW_PX.test(literal)) {
        RAW_PX.lastIndex = 0;
        if (![...literal.matchAll(RAW_PX)].every((px) => Number(px[1]) === 0)) {
          push(errors, file, line, `inline style ${key} uses a raw px length. Use a --space-* token class instead.`);
        }
      }
      RAW_PX.lastIndex = 0;
      if (number !== undefined && Number(number) !== 0) {
        push(errors, file, line, `inline style ${key}: ${number} is raw spacing. Use a --space-* token class instead.`);
      }
    }
  }
}

function scaleErrors(tokens) {
  const errors = [];
  const defined = [...tokens.keys()].sort((a, b) => a - b);
  const expected = [...PEN_SPACING_STEPS];
  if (defined.join(",") !== expected.join(",")) {
    errors.push({
      file: "src/index.css",
      line: 1,
      message: `Spacing scale must match drip-by-drip.pen steps (${expected.join(", ")}). :root defines (${defined.join(", ") || "none"}).`,
    });
  }
  for (const step of expected) {
    const value = tokens.get(step);
    if (value !== undefined && value !== `${step}px`) {
      errors.push({
        file: "src/index.css",
        line: 1,
        message: `--space-${step} must be ${step}px (found ${value}).`,
      });
    }
  }
  return errors;
}

export function auditSources(cssFiles, uiFiles) {
  const tokenFile = cssFiles.find((file) => file.path.replaceAll("\\", "/").endsWith("src/index.css")) ?? cssFiles[0];
  const tokens = tokenFile ? parseSpaceTokens(tokenFile.source) : new Map();
  const errors = scaleErrors(tokens);
  let declarations = 0;
  for (const file of cssFiles) declarations += auditCss(file.path, file.source, tokens, errors);
  for (const file of uiFiles) auditStyles(file.path, file.source, errors);
  return { ok: errors.length === 0, errors, declarations, tokens: tokens.size };
}

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, exts, out);
    else if (exts.some((ext) => name.endsWith(ext))) out.push(path);
  }
  return out;
}

export function auditRepo(root = ROOT) {
  const cssFiles = walk(join(root, "src"), [".css"]).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, "utf8"),
  }));
  const uiFiles = walk(join(root, "src"), [".tsx", ".jsx"]).map((path) => ({
    path: relative(root, path),
    source: readFileSync(path, "utf8"),
  }));
  return auditSources(cssFiles, uiFiles);
}

function main() {
  const result = auditRepo();
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`${error.file}:${error.line}: ${error.message}`);
    }
    console.error(`\n${result.errors.length} spacing token violation(s).`);
    process.exit(1);
  }
  console.log(
    `Spacing audit passed (${result.tokens} tokens, ${result.declarations} spacing declarations).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
