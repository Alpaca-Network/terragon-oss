#!/usr/bin/env tsx
/**
 * Build Health Monitor
 *
 * Scans the monorepo for:
 * - TypeScript compilation errors/warnings
 * - Dependency version conflicts between workspace packages and root overrides
 * - Known breaking change patterns in major dependencies
 * - Stale lock files and conflicting package managers
 *
 * Usage: pnpm build-health
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname =
  typeof import.meta.dirname === "string"
    ? import.meta.dirname
    : dirname(fileURLToPath(import.meta.url));
// __dirname resolves to <repo>/scripts/, so one level up is the repo root.
// This holds true regardless of CWD (e.g. when invoked via pnpm --filter).
const ROOT = join(__dirname, "..");

// ── Types ──────────────────────────────────────────────────────────────────

interface Finding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  message: string;
  file?: string;
  line?: number;
  fix?: string;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  pnpm?: {
    overrides?: Record<string, string>;
  };
}

// ── Utilities ──────────────────────────────────────────────────────────────

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function findWorkspacePackages(): { path: string; pkg: PackageJson }[] {
  const results: { path: string; pkg: PackageJson }[] = [];
  const dirs = ["apps", "packages"];

  for (const dir of dirs) {
    const base = join(ROOT, dir);
    if (!existsSync(base)) continue;

    for (const entry of readdirSync(base)) {
      const pkgPath = join(base, entry, "package.json");
      if (existsSync(pkgPath)) {
        const pkg = readJson<PackageJson>(pkgPath);
        if (pkg) results.push({ path: pkgPath, pkg });
      }
    }
  }
  return results;
}

function stripRange(version: string): string {
  return version.replace(/^[\^~>=<]+/, "");
}

function majorVersion(version: string): number {
  return parseInt(stripRange(version).split(".")[0], 10);
}

// ── Check 1: TypeScript Compilation ────────────────────────────────────────

function checkTypeScript(): Finding[] {
  const findings: Finding[] = [];
  console.log("  [1/4] Running TypeScript check...");

  try {
    const output = execSync("pnpm tsc-check 2>&1", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 300_000,
    });

    // Parse turbo output for errors
    const errorLines = output
      .split("\n")
      .filter(
        (l) =>
          l.includes("error TS") ||
          l.includes("Error:") ||
          l.includes("ELIFECYCLE"),
      );

    if (errorLines.length === 0) {
      findings.push({
        severity: "info",
        category: "TypeScript",
        message: "All workspace packages pass type checking",
      });
    } else {
      for (const line of errorLines) {
        const match = line.match(
          /(.+)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.*)/,
        );
        if (match) {
          findings.push({
            severity: "high",
            category: "TypeScript",
            message: `${match[3]}: ${match[4]}`,
            file: match[1],
            line: parseInt(match[2], 10),
            fix: `Fix the type error in ${match[1]}:${match[2]}`,
          });
        } else {
          findings.push({
            severity: "high",
            category: "TypeScript",
            message: line.trim(),
          });
        }
      }
    }

    // Check for warnings (non-error issues in output)
    const warningLines = output
      .split("\n")
      .filter((l) => /warning/i.test(l) && !l.includes("pnpm"));
    for (const line of warningLines) {
      findings.push({
        severity: "medium",
        category: "TypeScript",
        message: line.trim(),
      });
    }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    const combined = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
    const errorLines = combined
      .split("\n")
      .filter(
        (l) =>
          l.includes("error TS") ||
          l.includes("Error:") ||
          l.includes("ELIFECYCLE"),
      );

    for (const line of errorLines) {
      const match = line.match(/(.+)\((\d+),\d+\):\s*error\s+(TS\d+):\s*(.*)/);
      if (match) {
        findings.push({
          severity: "high",
          category: "TypeScript",
          message: `${match[3]}: ${match[4]}`,
          file: match[1],
          line: parseInt(match[2], 10),
          fix: `Fix the type error in ${match[1]}:${match[2]}`,
        });
      } else if (line.trim()) {
        findings.push({
          severity: "high",
          category: "TypeScript",
          message: line.trim(),
        });
      }
    }

    if (errorLines.length === 0) {
      findings.push({
        severity: "critical",
        category: "TypeScript",
        message: "tsc-check command failed unexpectedly",
        fix: "Run `pnpm tsc-check` manually to diagnose",
      });
    }
  }

  return findings;
}

// ── Check 2: Dependency Version Conflicts ──────────────────────────────────

function checkDependencyConflicts(): Finding[] {
  const findings: Finding[] = [];
  console.log("  [2/4] Analyzing dependency version conflicts...");

  const rootPkg = readJson<PackageJson>(join(ROOT, "package.json"));
  if (!rootPkg) {
    findings.push({
      severity: "critical",
      category: "Dependencies",
      message: "Could not read root package.json",
    });
    return findings;
  }

  // Check for conflicting lock files
  const hasPackageLock = existsSync(join(ROOT, "package-lock.json"));
  const hasPnpmLock = existsSync(join(ROOT, "pnpm-lock.yaml"));
  const hasYarnLock = existsSync(join(ROOT, "yarn.lock"));

  const lockFiles = [
    hasPackageLock && "package-lock.json",
    hasPnpmLock && "pnpm-lock.yaml",
    hasYarnLock && "yarn.lock",
  ].filter(Boolean) as string[];

  if (lockFiles.length > 1) {
    findings.push({
      severity: "critical",
      category: "Dependencies",
      message: `Multiple lock files detected: ${lockFiles.join(", ")}. This causes non-deterministic installs.`,
      fix: `Delete ${lockFiles.filter((f) => f !== "pnpm-lock.yaml").join(", ")} — this is a pnpm workspace`,
    });
  }

  const overrides = rootPkg.pnpm?.overrides ?? {};
  const workspaces = findWorkspacePackages();

  // Track all declared versions per dependency across workspaces
  const depVersionMap = new Map<
    string,
    { pkg: string; version: string; file: string; depType: string }[]
  >();

  for (const { path: pkgPath, pkg } of workspaces) {
    const name = pkg.name ?? pkgPath;
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps)) {
      if (version.startsWith("workspace:")) continue;
      if (!depVersionMap.has(dep)) depVersionMap.set(dep, []);
      depVersionMap.get(dep)!.push({
        pkg: name,
        version,
        file: relative(ROOT, pkgPath),
        depType:
          dep in (pkg.dependencies ?? {}) ? "dependencies" : "devDependencies",
      });
    }
  }

  // Check workspace versions against root overrides
  for (const [dep, overrideVersion] of Object.entries(overrides)) {
    const entries = depVersionMap.get(dep);
    if (!entries) continue;

    const overrideMajor = majorVersion(overrideVersion);

    for (const entry of entries) {
      const entryMajor = majorVersion(entry.version);

      if (entryMajor !== overrideMajor) {
        findings.push({
          severity: "high",
          category: "Dependencies",
          message: `${entry.pkg} declares ${dep}@${entry.version} but root override forces ${overrideVersion} (major version mismatch)`,
          file: entry.file,
          fix: `Update ${dep} in ${entry.file} to "${overrideVersion}" or "^${stripRange(overrideVersion)}"`,
        });
      } else if (stripRange(entry.version) !== stripRange(overrideVersion)) {
        // Same major but different minor/patch
        const entrySemver = stripRange(entry.version).split(".");
        const overrideSemver = stripRange(overrideVersion).split(".");
        if (
          entrySemver[1] !== overrideSemver[1] ||
          entrySemver[2] !== overrideSemver[2]
        ) {
          findings.push({
            severity: "low",
            category: "Dependencies",
            message: `${entry.pkg} declares ${dep}@${entry.version}, root override is ${overrideVersion} (minor drift)`,
            file: entry.file,
            fix: `Align ${dep} in ${entry.file} to "^${stripRange(overrideVersion)}" for consistency`,
          });
        }
      }
    }
  }

  // Check for duplicate versions of the same dependency across workspaces
  for (const [dep, entries] of depVersionMap) {
    if (entries.length < 2) continue;
    if (dep in overrides) continue; // Already checked above

    const versions = new Set(entries.map((e) => stripRange(e.version)));
    if (versions.size > 1) {
      const majors = new Set(entries.map((e) => majorVersion(e.version)));
      findings.push({
        severity: majors.size > 1 ? "high" : "medium",
        category: "Dependencies",
        message: `${dep} has ${versions.size} different versions across workspaces: ${[...versions].join(", ")}`,
        fix: `Standardize ${dep} version across all workspace packages, or add a pnpm override`,
      });
    }
  }

  // Check for deps in both dependencies and devDependencies within the same package
  for (const { path: pkgPath, pkg } of workspaces) {
    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});
    const overlap = deps.filter((d) => devDeps.includes(d));
    for (const dep of overlap) {
      findings.push({
        severity: "medium",
        category: "Dependencies",
        message: `${pkg.name}: ${dep} appears in both dependencies and devDependencies`,
        file: relative(ROOT, pkgPath),
        fix: `Remove ${dep} from one of dependencies or devDependencies in ${relative(ROOT, pkgPath)}`,
      });
    }
  }

  return findings;
}

// ── Check 3: Breaking Change Patterns ──────────────────────────────────────

function checkBreakingChanges(): Finding[] {
  const findings: Finding[] = [];
  console.log("  [3/4] Scanning for breaking change patterns...");

  const patterns: {
    name: string;
    pattern: RegExp;
    extensions: string[];
    severity: Finding["severity"];
    message: string;
    fix: string;
  }[] = [
    // Zod v4: deprecated string methods
    {
      name: "Zod v4 deprecated .email()",
      pattern: /z\.string\(\)\.email\(\)/,
      extensions: ["ts", "tsx"],
      severity: "medium",
      message: "Zod v4: z.string().email() is deprecated, use z.email()",
      fix: "Replace z.string().email() with z.email()",
    },
    {
      name: "Zod v4 deprecated .uuid()",
      pattern: /z\.string\(\)\.uuid\(\)/,
      extensions: ["ts", "tsx"],
      severity: "medium",
      message: "Zod v4: z.string().uuid() is deprecated, use z.uuid()",
      fix: "Replace z.string().uuid() with z.uuid()",
    },
    {
      name: "Zod v4 deprecated .url()",
      pattern: /z\.string\(\)\.url\(\)/,
      extensions: ["ts", "tsx"],
      severity: "medium",
      message: "Zod v4: z.string().url() is deprecated, use z.url()",
      fix: "Replace z.string().url() with z.url()",
    },
    // React 19 deprecated APIs
    {
      name: "React deprecated defaultProps",
      pattern: /\.defaultProps[[:space:]]*=/,
      extensions: ["tsx", "jsx"],
      severity: "high",
      message: "React 19: defaultProps on function components is deprecated",
      fix: "Use default parameter values in the function signature instead",
    },
    {
      name: "React deprecated findDOMNode",
      pattern: /findDOMNode\(/,
      extensions: ["ts", "tsx", "js", "jsx"],
      severity: "high",
      message: "React 19: findDOMNode is removed",
      fix: "Use refs instead of findDOMNode",
    },
    {
      name: "React deprecated string refs",
      pattern: /ref=["'][a-zA-Z]+["']/,
      extensions: ["tsx", "jsx"],
      severity: "high",
      message: "React 19: string refs are removed",
      fix: "Use callback refs or useRef() instead",
    },
    // Next.js 15 deprecations (prep for 16)
    {
      name: "Next.js deprecated legacyBehavior",
      pattern: /legacyBehavior/,
      extensions: ["ts", "tsx", "js", "jsx"],
      severity: "low",
      message:
        "Next.js: legacyBehavior prop on next/link is deprecated and will be removed in v16",
      fix: "Remove legacyBehavior and update link usage to Next.js 13+ format",
    },
    // Drizzle ORM: chained .array()
    {
      name: "Drizzle chained .array().array()",
      pattern: /\.array\(\)\.array\(\)/,
      extensions: ["ts", "tsx"],
      severity: "medium",
      message:
        "Drizzle ORM 0.43+: chained .array().array() is no longer supported",
      fix: "Replace .array().array() with .array('[][]')",
    },
  ];

  for (const check of patterns) {
    try {
      // Escape single quotes in the regex source for safe shell embedding
      const escaped = check.pattern.source.replace(/'/g, "'\\''");
      const includes = check.extensions
        .map((ext) => `--include='*.${ext}'`)
        .join(" ");
      const result = execSync(
        `grep -rn ${includes} --exclude-dir=node_modules --exclude-dir=.next -E '${escaped}' apps/ packages/ 2>/dev/null || true`,
        { cwd: ROOT, encoding: "utf-8", timeout: 30_000 },
      );

      for (const line of result.split("\n").filter(Boolean)) {
        // Skip node_modules and .next directories
        if (line.includes("node_modules/") || line.includes(".next/")) continue;

        const match = line.match(/^(.+?):(\d+):/);
        if (match) {
          findings.push({
            severity: check.severity,
            category: "Breaking Changes",
            message: check.message,
            file: match[1],
            line: parseInt(match[2], 10),
            fix: check.fix,
          });
        }
      }
    } catch {
      // grep failure is non-fatal
    }
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      category: "Breaking Changes",
      message: "No known breaking change patterns detected",
    });
  }

  return findings;
}

// ── Check 4: pnpm Install Warnings ────────────────────────────────────────

function checkInstallWarnings(): Finding[] {
  const findings: Finding[] = [];
  console.log("  [4/4] Checking pnpm install warnings...");

  try {
    // Dry-run: report what would change without modifying node_modules
    const output = execSync("pnpm install --dry-run 2>&1", {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 120_000,
    });

    // Parse peer dependency warnings
    const peerWarnings = output
      .split("\n")
      .filter((l) => /peer dep|WARN|deprecated/i.test(l));
    for (const line of peerWarnings) {
      if (/deprecated/i.test(line)) {
        findings.push({
          severity: "medium",
          category: "Install",
          message: `Deprecated package: ${line.trim()}`,
          fix: "Check for an alternative or updated version",
        });
      } else if (/peer/i.test(line)) {
        findings.push({
          severity: "low",
          category: "Install",
          message: `Peer dependency issue: ${line.trim()}`,
        });
      }
    }

    // Check for ignored build scripts warning
    if (output.includes("Ignored build scripts")) {
      const match = output.match(/Ignored build scripts:\s*([^\n]+)/);
      if (match) {
        findings.push({
          severity: "low",
          category: "Install",
          message: `Build scripts ignored for: ${match[1].trim()}`,
          fix: 'Run "pnpm approve-builds" if these packages need post-install scripts',
        });
      }
    }
  } catch {
    findings.push({
      severity: "info",
      category: "Install",
      message:
        "Could not run frozen install check (lockfile may be out of date)",
      fix: "Run `pnpm install` to update the lockfile",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      category: "Install",
      message: "No install warnings detected",
    });
  }

  return findings;
}

// ── Report Generation ──────────────────────────────────────────────────────

function generateReport(findings: Finding[]): string {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sorted = [...findings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  const counts = {
    critical: sorted.filter((f) => f.severity === "critical").length,
    high: sorted.filter((f) => f.severity === "high").length,
    medium: sorted.filter((f) => f.severity === "medium").length,
    low: sorted.filter((f) => f.severity === "low").length,
    info: sorted.filter((f) => f.severity === "info").length,
  };

  const severityIcon: Record<string, string> = {
    critical: "[CRIT]",
    high: "[HIGH]",
    medium: "[MED] ",
    low: "[LOW] ",
    info: "[INFO]",
  };

  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push("  BUILD HEALTH REPORT");
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push("=".repeat(72));
  lines.push("");

  // Summary
  const actionable = counts.critical + counts.high + counts.medium;
  if (actionable === 0) {
    lines.push("  Status: HEALTHY");
  } else if (counts.critical > 0) {
    lines.push("  Status: CRITICAL ISSUES FOUND");
  } else if (counts.high > 0) {
    lines.push("  Status: ISSUES FOUND");
  } else {
    lines.push("  Status: MINOR ISSUES");
  }
  lines.push("");
  lines.push(
    `  Critical: ${counts.critical}  High: ${counts.high}  Medium: ${counts.medium}  Low: ${counts.low}  Info: ${counts.info}`,
  );
  lines.push("");
  lines.push("-".repeat(72));

  // Group by category
  const categories = new Map<string, Finding[]>();
  for (const f of sorted) {
    if (!categories.has(f.category)) categories.set(f.category, []);
    categories.get(f.category)!.push(f);
  }

  for (const [category, items] of categories) {
    lines.push("");
    lines.push(`  ${category.toUpperCase()}`);
    lines.push("  " + "-".repeat(category.length));
    lines.push("");

    for (const item of items) {
      const icon = severityIcon[item.severity];
      lines.push(`  ${icon} ${item.message}`);
      if (item.file) {
        const loc = item.line ? `${item.file}:${item.line}` : item.file;
        lines.push(`         File: ${loc}`);
      }
      if (item.fix) {
        lines.push(`         Fix:  ${item.fix}`);
      }
      lines.push("");
    }
  }

  lines.push("-".repeat(72));
  lines.push("");

  // Actionable summary
  if (actionable > 0) {
    lines.push("  RECOMMENDED ACTIONS:");
    lines.push("");

    let idx = 1;
    for (const item of sorted) {
      if (
        item.fix &&
        (item.severity === "critical" ||
          item.severity === "high" ||
          item.severity === "medium")
      ) {
        lines.push(`  ${idx}. [${item.severity.toUpperCase()}] ${item.fix}`);
        if (item.file) lines.push(`     File: ${item.file}`);
        idx++;
      }
    }
    lines.push("");
  }

  lines.push("=".repeat(72));
  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("");
  console.log("Build Health Monitor");
  console.log("====================");
  console.log("");

  const allFindings: Finding[] = [];

  allFindings.push(...checkTypeScript());
  allFindings.push(...checkDependencyConflicts());
  allFindings.push(...checkBreakingChanges());
  allFindings.push(...checkInstallWarnings());

  const report = generateReport(allFindings);
  console.log("");
  console.log(report);

  // Write report to file
  const reportPath = join(ROOT, "build-health-report.txt");
  writeFileSync(reportPath, report, "utf-8");
  console.log(`Report written to: ${relative(ROOT, reportPath)}`);

  // Exit with non-zero if critical or high issues found
  const hasBlockers = allFindings.some(
    (f) => f.severity === "critical" || f.severity === "high",
  );
  process.exit(hasBlockers ? 1 : 0);
}

main();
