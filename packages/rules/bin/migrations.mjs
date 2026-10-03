#!/usr/bin/env node
import * as fs from "node:fs";
import path from "node:path";

const DEFAULT_WORKSPACES = ["apps/*", "packages/*"];
const WORKSPACE_LIST_ITEM = /^\s+-\s+["']?([^"'#\s]+)["']?\s*$/u;
const SOURCE_FILE = /\.(?:ts|tsx|mts|cts)$/u;
const SKIPPED_DIRECTORY = (name) => name === "node_modules" || name.startsWith(".");
const IDENTIFIER = String.raw`(?:"[^"]+"|\x60[^\x60]+\x60|[A-Za-z_][\w$]*)`;
const NAME = String.raw`(${IDENTIFIER}(?:\s*\.\s*${IDENTIFIER})?)`;
const CREATE_TABLE = new RegExp(
  String.raw`\bcreate\s+(?:(?:temporary|temp|unlogged)\s+)?table\s+(?:if\s+not\s+exists\s+)?${NAME}`,
  "giu",
);
const REFERENCES = new RegExp(String.raw`\breferences\s+${NAME}`, "giu");
const TOUCHES = new RegExp(
  String.raw`\b(?:from|join|into|update|(?:alter|drop|truncate)\s+table(?:\s+if\s+exists)?(?:\s+only)?)\s+${NAME}`,
  "giu",
);
const SQL_STATEMENT = /\b(?:select|insert|update|delete|alter|drop|truncate|merge)\b/iu;
const OPENS_TRANSACTION_CALL = /\bwithTransaction\b/u;
const OPENS_TRANSACTION_SQL = /^\s*(?:begin|start\s+transaction)\b/iu;

const relative = (file) => path.relative(process.cwd(), file).split(path.sep).join("/");

const tableName = (raw) =>
  raw
    .split(".")
    .at(-1)
    .trim()
    .replace(/^["\x60]|["\x60]$/gu, "")
    .toLowerCase();

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

const workspacePatterns = () => {
  if (!fs.existsSync("pnpm-workspace.yaml")) return DEFAULT_WORKSPACES;
  const lines = fs.readFileSync("pnpm-workspace.yaml", "utf8").split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === "packages:");
  const patterns = [];
  for (const line of start === -1 ? [] : lines.slice(start + 1)) {
    const item = WORKSPACE_LIST_ITEM.exec(line);
    if (item === null) break;
    patterns.push(item[1]);
  }
  return patterns.length > 0 ? patterns : DEFAULT_WORKSPACES;
};

const workspaceDirectories = () =>
  fs
    .globSync(workspacePatterns().map((pattern) => `${pattern}/package.json`))
    .map((manifest) => path.dirname(manifest).split(path.sep).join("/"))
    .sort();

const walk = (directory, keep) => {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORY(entry.name) ? [] : walk(full, keep);
    return entry.isFile() && keep(entry.name) ? [full] : [];
  });
};

// Blanks SQL comments and string literals, keeping offsets so line numbers stay true.
const blankSql = (sql) =>
  sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'/gu, (match) =>
    match.replace(/[^\n]/gu, " "),
  );

// Splits TypeScript into string-literal text and code, with offsets. `sql` keeps the strings and template literals that hold a SQL keyword.
const lexSource = (source) => {
  const strings = [];
  const code = [];
  const braces = [];
  let index = 0;
  let codeStart = 0;
  const flushCode = (end) => {
    if (end > codeStart) code.push({ text: source.slice(codeStart, end), start: codeStart });
  };
  let templates = 0;
  const readTemplate = (template) => {
    const start = index;
    while (index < source.length) {
      const character = source[index];
      if (character === "\\") {
        index += 2;
      } else if (character === "`") {
        strings.push({ text: source.slice(start, index), start, template });
        index += 1;
        return;
      } else if (character === "$" && source[index + 1] === "{") {
        strings.push({ text: source.slice(start, index), start, template });
        index += 2;
        braces.push(template);
        return;
      } else {
        index += 1;
      }
    }
    strings.push({ text: source.slice(start), start, template });
  };
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === "/" && next === "/") {
      flushCode(index);
      index = source.indexOf("\n", index);
      if (index === -1) index = source.length;
      codeStart = index;
    } else if (character === "/" && next === "*") {
      flushCode(index);
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      codeStart = index;
    } else if (character === '"' || character === "'") {
      flushCode(index);
      const start = index + 1;
      index = start;
      while (index < source.length && source[index] !== character && source[index] !== "\n") {
        index += source[index] === "\\" ? 2 : 1;
      }
      strings.push({ text: source.slice(start, index), start });
      index += 1;
      codeStart = index;
    } else if (character === "`") {
      flushCode(index);
      index += 1;
      templates += 1;
      readTemplate(templates);
      codeStart = index;
    } else if (character === "{") {
      braces.push("code");
      index += 1;
    } else if (character === "}" && typeof braces.at(-1) === "number") {
      flushCode(index);
      const template = braces.pop();
      index += 1;
      readTemplate(template);
      codeStart = index;
    } else {
      if (character === "}") braces.pop();
      index += 1;
    }
  }
  flushCode(source.length);
  const sqlTemplates = new Set(
    strings
      .filter((part) => part.template && SQL_STATEMENT.test(part.text))
      .map((part) => part.template),
  );
  const sql = strings.filter((part) =>
    part.template ? sqlTemplates.has(part.template) : SQL_STATEMENT.test(part.text),
  );
  return { strings, sql, code };
};

const problems = [];
const report = (file, line, message) => problems.push(`  ${relative(file)}:${line}: ${message}`);

const workspaces = workspaceDirectories();
const migrationFolders = new Map(workspaces.map((dir) => [path.resolve(dir, "migrations"), dir]));
const migrations = [];

for (const file of walk(process.cwd(), (name) => name.endsWith(".sql"))) {
  const owner = migrationFolders.get(path.dirname(file));
  if (owner === undefined) {
    report(
      file,
      1,
      "this SQL file sits outside a `<package>/migrations/` folder. Move it into the migrations folder of the package that owns its tables.",
    );
  } else {
    migrations.push({ file, owner, sql: blankSql(fs.readFileSync(file, "utf8")) });
  }
}

migrations.sort((a, b) => a.file.localeCompare(b.file));
const owners = new Map();
for (const { file, owner, sql } of migrations) {
  for (const match of sql.matchAll(CREATE_TABLE)) {
    const table = tableName(match[1]);
    const creators = owners.get(table) ?? [];
    if (creators.length > 0 && !creators.includes(owner)) {
      report(
        file,
        lineAt(sql, match.index),
        `table "${table}" is already created by ${creators[0]}. A table has one owning package.`,
      );
    }
    if (!creators.includes(owner)) owners.set(table, [...creators, owner]);
  }
}

// A table that two packages create counts as owned by both, so the duplicate is the only report.
const foreignOwner = (table, owner) => {
  const creators = owners.get(tableName(table));
  return creators !== undefined && !creators.includes(owner) ? creators[0] : undefined;
};

for (const { file, owner, sql } of migrations) {
  for (const match of sql.matchAll(REFERENCES)) {
    const other = foreignOwner(match[1], owner);
    if (other === undefined) continue;
    report(
      file,
      lineAt(sql, match.index),
      `foreign key to "${tableName(match[1])}", a table ${other} owns. No cross-module foreign keys: keep the id as a plain column and ask ${other}'s service for the record.`,
    );
  }
  for (const match of sql.matchAll(TOUCHES)) {
    const other = foreignOwner(match[1], owner);
    if (other === undefined) continue;
    report(
      file,
      lineAt(sql, match.index),
      `touches "${tableName(match[1])}", a table ${other} owns. A migration changes only its own package's tables.`,
    );
  }
}

for (const workspace of workspaces) {
  const useCases = path.resolve(workspace, "src", "use-cases");
  for (const file of walk(path.resolve(workspace, "src"), (name) => SOURCE_FILE.test(name))) {
    const source = fs.readFileSync(file, "utf8");
    const { strings, sql, code } = lexSource(source);
    if (owners.size > 0) {
      for (const { text, start } of sql) {
        for (const match of text.matchAll(TOUCHES)) {
          const other = foreignOwner(match[1], workspace);
          if (other === undefined) continue;
          report(
            file,
            lineAt(source, start + match.index),
            `SQL names "${tableName(match[1])}", a table ${other} owns. A module's SQL touches only its own tables: call ${other}'s service, or move the table's migration into this package if it owns the table.`,
          );
        }
      }
    }
    if (!file.startsWith(`${useCases}${path.sep}`)) continue;
    const opening = [
      ...code.map((part) => ({ part, match: OPENS_TRANSACTION_CALL.exec(part.text) })),
      ...strings.map((part) => ({ part, match: OPENS_TRANSACTION_SQL.exec(part.text) })),
    ].find(({ match }) => match !== null);
    if (opening !== undefined) {
      report(
        file,
        lineAt(source, opening.part.start + opening.match.index),
        "a use-case opens a transaction. One module method is one transaction: move this work into a method of the module's service.",
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`migrations: ${problems.length} problem(s) with module-owned SQL:`);
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

const ownerCount = new Set([...owners.values()].flat()).size;
console.log(
  migrations.length === 0
    ? "migrations: no SQL migrations found"
    : `migrations: ${owners.size} table(s) owned by ${ownerCount} package(s); no cross-module foreign keys or SQL`,
);
