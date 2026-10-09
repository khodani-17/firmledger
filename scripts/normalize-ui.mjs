import fs from "fs";
import path from "path";

const ROOT = path.resolve("src/app");

const SKIP = new Set([
  "globals.css",
]);

const FILE_EXTENSIONS = new Set([".tsx"]);

let changedFiles = 0;
let scannedFiles = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const files = [];

  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name.startsWith(".")
    ) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeClassName(className) {
  let result = className;

  /*
   * -------------------------------------------------------
   * Typography
   * -------------------------------------------------------
   *
   * Reduce excessively large Tailwind text sizes.
   */

  result = result.replace(/\btext-7xl\b/g, "text-3xl");
  result = result.replace(/\btext-6xl\b/g, "text-3xl");
  result = result.replace(/\btext-5xl\b/g, "text-2xl");
  result = result.replace(/\btext-4xl\b/g, "text-2xl");

  /*
   * Keep headings medium-sized.
   */

  result = result.replace(/\btext-3xl\b/g, "text-2xl");

  /*
   * Avoid extremely small text for normal content.
   */

  result = result.replace(/\btext-\[10px\]\b/g, "text-xs");
  result = result.replace(/\btext-\[11px\]\b/g, "text-xs");

  /*
   * -------------------------------------------------------
   * Excessive spacing
   * -------------------------------------------------------
   */

  result = result.replace(/\bp-\[([0-9]+)px\]\b/g, "p-4");
  result = result.replace(/\bpx-\[([0-9]+)px\]\b/g, "px-4");
  result = result.replace(/\bpy-\[([0-9]+)px\]\b/g, "py-4");

  result = result.replace(/\bpx-10\b/g, "px-6");
  result = result.replace(/\bpx-12\b/g, "px-6");

  result = result.replace(/\bpy-10\b/g, "py-6");
  result = result.replace(/\bpy-12\b/g, "py-6");

  result = result.replace(/\bp-10\b/g, "p-6");
  result = result.replace(/\bp-12\b/g, "p-6");

  /*
   * -------------------------------------------------------
   * Excessive margins
   * -------------------------------------------------------
   */

  result = result.replace(/\bmt-10\b/g, "mt-6");
  result = result.replace(/\bmt-12\b/g, "mt-6");

  result = result.replace(/\bmb-10\b/g, "mb-6");
  result = result.replace(/\bmb-12\b/g, "mb-6");

  /*
   * -------------------------------------------------------
   * Excessive gaps
   * -------------------------------------------------------
   */

  result = result.replace(/\bgap-10\b/g, "gap-6");
  result = result.replace(/\bgap-12\b/g, "gap-6");

  /*
   * -------------------------------------------------------
   * Very large rounded corners
   * -------------------------------------------------------
   */

  result = result.replace(/\brounded-3xl\b/g, "rounded-lg");
  result = result.replace(/\brounded-2xl\b/g, "rounded-lg");

  /*
   * -------------------------------------------------------
   * Normalize common card padding
   * -------------------------------------------------------
   */

  result = result.replace(
    /\bbg-\[var\(--surface\)\]\s+rounded-xl\s+p-8\b/g,
    "card compact-card"
  );

  return result;
}

function normalizeTables(content) {
  let result = content;

  /*
   * Add the standard table classes when a table
   * already uses a generic table element.
   *
   * We deliberately do NOT rewrite the actual
   * table structure because that could affect logic.
   */

  result = result.replace(
    /<table(\s+className="([^"]*)")?>/g,
    (match, attr = "", classes = "") => {
      let className = classes;

      if (!/\btable\b/.test(className)) {
        className = `${className} table`.trim();
      }

      return `<table className="${className}">`;
    }
  );

  /*
   * Tables without className.
   */

  result = result.replace(
    /<table>/g,
    '<table className="table">'
  );

  return result;
}

function normalizeButtons(content) {
  let result = content;

  /*
   * Preserve buttons that already use our design system.
   */

  const knownButtons = [
    "primary-button",
    "secondary-button",
    "logout-button",
  ];

  /*
   * Normalize common Tailwind button sizes.
   */

  result = result.replace(
    /\bpy-4\b/g,
    "py-2"
  );

  result = result.replace(
    /\bpy-3\b/g,
    "py-2"
  );

  /*
   * Prevent very large button text.
   */

  result = result.replace(
    /\btext-lg\b/g,
    "text-sm"
  );

  result = result.replace(
    /\btext-xl\b/g,
    "text-sm"
  );

  return result;
}

function normalizeForms(content) {
  let result = content;

  /*
   * Existing generic forms.
   */

  result = result.replace(
    /className="([^"]*)form-grid([^"]*)"/g,
    (match, before, after) => {
      const combined = `${before}form-grid${after}`;

      if (!/\bform-grid\b/.test(combined)) {
        return match;
      }

      return `className="${combined}"`;
    }
  );

  /*
   * Prevent oversized form controls.
   */

  result = result.replace(
    /\bpy-4\b/g,
    "py-2"
  );

  result = result.replace(
    /\bmin-h-14\b/g,
    "min-h-10"
  );

  return result;
}

function normalizePageContainers(content) {
  let result = content;

  /*
   * Normalize common full-page spacing.
   */

  result = result.replace(
    /\bmin-h-screen\s+bg-\[var\(--app-bg\)\]\s+p-10\b/g,
    "min-h-screen bg-[var(--app-bg)] px-6 py-5"
  );

  result = result.replace(
    /\bmin-h-screen\s+bg-\[var\(--app-bg\)\]\s+p-12\b/g,
    "min-h-screen bg-[var(--app-bg)] px-6 py-5"
  );

  /*
   * Standard maximum page width.
   */

  result = result.replace(
    /\bmax-w-\[1800px\]\b/g,
    "max-w-[1600px]"
  );

  result = result.replace(
    /\bmax-w-\[1900px\]\b/g,
    "max-w-[1600px]"
  );

  result = result.replace(
    /\bmax-w-\[2000px\]\b/g,
    "max-w-[1600px]"
  );

  /*
   * Keep common content widths reasonable.
   */

  result = result.replace(
    /\bmax-w-7xl\b/g,
    "max-w-[1600px]"
  );

  result = result.replace(
    /\bmax-w-6xl\b/g,
    "max-w-[1400px]"
  );

  return result;
}

function normalizeFile(filePath) {
  const original = fs.readFileSync(filePath, "utf8");

  let content = original;

  content = normalizeClassNames(content);
  content = normalizeTables(content);
  content = normalizeButtons(content);
  content = normalizeForms(content);
  content = normalizePageContainers(content);

  if (content !== original) {
    fs.writeFileSync(filePath, content, "utf8");
    changedFiles++;

    console.log(
      `UPDATED  ${path.relative(process.cwd(), filePath)}`
    );
  } else {
    console.log(
      `OK       ${path.relative(process.cwd(), filePath)}`
    );
  }

  scannedFiles++;
}

function normalizeClassNames(content) {
  let result = content;

  /*
   * Normalize every className="..."
   * without touching JavaScript or server logic.
   */

  result = result.replace(
    /className="([^"]*)"/g,
    (match, className) => {
      const normalized = normalizeClassName(className);

      return `className="${normalized}"`;
    }
  );

  return result;
}

function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`Cannot find ${ROOT}`);
    process.exit(1);
  }

  const files = walk(ROOT);

  console.log("");
  console.log("==============================================");
  console.log(" FirmLedger UI Normalizer");
  console.log("==============================================");
  console.log("");

  console.log(`Scanning: ${ROOT}`);
  console.log(`TSX files: ${files.length}`);
  console.log("");

  for (const file of files) {
    if (SKIP.has(path.basename(file))) {
      continue;
    }

    normalizeFile(file);
  }

  console.log("");
  console.log("==============================================");
  console.log(" Completed");
  console.log("==============================================");
  console.log(`Scanned: ${scannedFiles}`);
  console.log(`Updated: ${changedFiles}`);
  console.log("");

  if (changedFiles === 0) {
    console.log("No files required changes.");
  } else {
    console.log(
      "UI classes were normalized without intentionally changing business logic."
    );
  }

  console.log("");
}

main();