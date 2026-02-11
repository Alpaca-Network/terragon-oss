import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";

interface LocalInsightsProps {
  days?: number;
  outputPath?: string;
}

export function LocalInsightsCommand({
  days = 30,
  outputPath,
}: LocalInsightsProps) {
  const [status, setStatus] = useState<string>("Initializing...");
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    async function analyzeLocalSessions() {
      try {
        setStatus("Discovering local sessions...");
        const sessions = await discoverSessions(days);

        if (sessions.length === 0) {
          setError(
            "No local sessions found. Pull some threads first with 'terry pull'.",
          );
          return;
        }

        setStatus(`Found ${sessions.length} sessions. Extracting metadata...`);
        const metadata = await extractMetadata(sessions);

        setStatus("Analyzing sessions with Claude...");
        const facets = await extractFacets(metadata);

        setStatus("Generating report...");
        const reportPath = await generateReport(facets, outputPath);

        setStatus(`✓ Report generated: ${reportPath}`);
        setIsComplete(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    analyzeLocalSessions();
  }, [days, outputPath]);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Error: {error}</Text>
      </Box>
    );
  }

  if (isComplete) {
    return (
      <Box flexDirection="column">
        <Text color="green">{status}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="blue">
          <Spinner type="dots" />
        </Text>{" "}
        {status}
      </Text>
    </Box>
  );
}

interface SessionFile {
  projectPath: string;
  sessionId: string;
  filePath: string;
  modifiedTime: Date;
}

// Stage 1: Discover sessions from ~/.claude/projects
async function discoverSessions(days: number): Promise<SessionFile[]> {
  const claudeProjectsDir = join(homedir(), ".claude", "projects");
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sessions: SessionFile[] = [];

  try {
    const projects = await fs.readdir(claudeProjectsDir);

    for (const project of projects) {
      const projectPath = join(claudeProjectsDir, project);
      const stat = await fs.stat(projectPath);

      if (!stat.isDirectory()) continue;

      const files = await fs.readdir(projectPath);

      for (const file of files) {
        if (!file.endsWith(".jsonl")) continue;

        const filePath = join(projectPath, file);
        const fileStat = await fs.stat(filePath);

        if (fileStat.mtime >= cutoffDate) {
          sessions.push({
            projectPath: project,
            sessionId: file.replace(".jsonl", ""),
            filePath,
            modifiedTime: fileStat.mtime,
          });
        }
      }
    }
  } catch (err) {
    // Directory doesn't exist or isn't accessible
    return [];
  }

  return sessions.sort(
    (a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime(),
  );
}

interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  timestamp: Date;
  messageCount: number;
  toolCalls: number;
  transcript: string;
  languages: Set<string>;
  filesModified: Set<string>;
  gitActivity: boolean;
}

// Stage 2: Extract metadata from JSONL files
async function extractMetadata(
  sessions: SessionFile[],
): Promise<SessionMetadata[]> {
  const metadata: SessionMetadata[] = [];

  for (const session of sessions) {
    try {
      const content = await fs.readFile(session.filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      const messages = lines.map((line) => JSON.parse(line));

      const languages = new Set<string>();
      const filesModified = new Set<string>();
      let toolCalls = 0;
      let gitActivity = false;
      const transcriptParts: string[] = [];

      for (const msg of messages) {
        // Build transcript
        if (msg.role === "user" && typeof msg.content === "string") {
          transcriptParts.push(`User: ${msg.content}`);
        } else if (msg.role === "assistant") {
          if (typeof msg.content === "string") {
            transcriptParts.push(`Assistant: ${msg.content}`);
          } else if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === "text") {
                transcriptParts.push(`Assistant: ${block.text}`);
              } else if (block.type === "tool_use") {
                toolCalls++;

                // Track tool usage
                const toolName = block.name;
                if (toolName === "Bash" && block.input?.command) {
                  if (block.input.command.startsWith("git ")) {
                    gitActivity = true;
                  }
                } else if (
                  ["Edit", "Write", "Read"].includes(toolName) &&
                  block.input?.file_path
                ) {
                  filesModified.add(block.input.file_path);

                  // Detect language from file extension
                  const ext = block.input.file_path
                    .split(".")
                    .pop()
                    ?.toLowerCase();
                  if (ext) {
                    const langMap: Record<string, string> = {
                      ts: "TypeScript",
                      tsx: "TypeScript",
                      js: "JavaScript",
                      jsx: "JavaScript",
                      py: "Python",
                      go: "Go",
                      rs: "Rust",
                      java: "Java",
                      rb: "Ruby",
                      php: "PHP",
                    };
                    if (langMap[ext]) {
                      languages.add(langMap[ext]);
                    }
                  }
                }
              }
            }
          }
        }
      }

      metadata.push({
        sessionId: session.sessionId,
        projectPath: session.projectPath,
        timestamp: session.modifiedTime,
        messageCount: messages.length,
        toolCalls,
        transcript: transcriptParts.join("\n\n"),
        languages,
        filesModified,
        gitActivity,
      });
    } catch (err) {
      // Skip malformed session files
      console.error(`Failed to parse ${session.filePath}:`, err);
    }
  }

  return metadata;
}

interface SessionFacet {
  sessionId: string;
  goal: string;
  outcome: "success" | "partial" | "failure" | "unknown";
  satisfaction:
    | "frustrated"
    | "dissatisfied"
    | "likely_satisfied"
    | "satisfied"
    | "happy"
    | "unsure";
  friction: string[];
  summary: string;
}

// Stage 3: Extract facets using Claude (with caching)
async function extractFacets(
  metadata: SessionMetadata[],
): Promise<SessionFacet[]> {
  const { extractSessionFacets } = await import("../utils/claude-analyzer.js");
  const cacheDir = join(homedir(), ".terry", "usage-data", "facets");
  await fs.mkdir(cacheDir, { recursive: true });

  const facets: SessionFacet[] = [];

  for (const meta of metadata) {
    const cacheFile = join(cacheDir, `${meta.sessionId}.json`);

    // Try to load from cache
    try {
      const cached = await fs.readFile(cacheFile, "utf-8");
      const cachedFacet = JSON.parse(cached);
      facets.push(cachedFacet);
      continue; // Skip API call if cached
    } catch {
      // Cache miss, analyze with Claude
    }

    const facet = await extractSessionFacets(meta.transcript, meta.sessionId);
    const fullFacet = {
      sessionId: meta.sessionId,
      ...facet,
    };

    facets.push(fullFacet);

    // Save to cache
    try {
      await fs.writeFile(cacheFile, JSON.stringify(fullFacet, null, 2));
    } catch (err) {
      // Non-critical cache write failure
      console.error(`Failed to cache facet for ${meta.sessionId}:`, err);
    }
  }

  return facets;
}

// Stage 4: Generate HTML report
async function generateReport(
  facets: SessionFacet[],
  outputPath?: string,
): Promise<string> {
  const reportDir = join(homedir(), ".terry", "usage-data");
  await fs.mkdir(reportDir, { recursive: true });

  const reportPath = outputPath || join(reportDir, "local-report.html");

  // Calculate statistics
  const outcomeStats = facets.reduce(
    (acc, f) => {
      acc[f.outcome] = (acc[f.outcome] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const satisfactionStats = facets.reduce(
    (acc, f) => {
      acc[f.satisfaction] = (acc[f.satisfaction] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const allFriction = facets.flatMap((f) => f.friction);
  const frictionCounts = allFriction.reduce(
    (acc, f) => {
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topFriction = Object.entries(frictionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Terry Local Insights Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    h1 {
      color: #667eea;
      font-size: 36px;
      margin: 0 0 10px 0;
      font-weight: 700;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .stat-label {
      font-size: 14px;
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h2 {
      color: #333;
      font-size: 24px;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    .chart-container {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-item {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .bar-label {
      min-width: 120px;
      font-size: 14px;
      font-weight: 500;
    }
    .bar-visual {
      flex: 1;
      height: 30px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
      position: relative;
      transition: all 0.3s ease;
    }
    .bar-visual:hover {
      transform: scaleX(1.02);
    }
    .bar-count {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    .session-card {
      background: white;
      border: 1px solid #e0e0e0;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      transition: all 0.2s ease;
    }
    .session-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }
    .session-id {
      font-family: "SF Mono", Monaco, "Cascadia Code", monospace;
      color: #999;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .session-goal {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 10px;
    }
    .session-summary {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 15px;
    }
    .session-meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-partial { background: #fff3cd; color: #856404; }
    .badge-failure { background: #f8d7da; color: #721c24; }
    .badge-unknown { background: #e2e3e5; color: #383d41; }
    .badge-happy { background: #d1ecf1; color: #0c5460; }
    .badge-satisfied { background: #d4edda; color: #155724; }
    .badge-likely_satisfied { background: #d1ecf1; color: #0c5460; }
    .badge-dissatisfied { background: #fff3cd; color: #856404; }
    .badge-frustrated { background: #f8d7da; color: #721c24; }
    .badge-unsure { background: #e2e3e5; color: #383d41; }
    .friction-list {
      margin-top: 10px;
    }
    .friction-item {
      display: inline-block;
      background: #f8d7da;
      color: #721c24;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 11px;
      margin: 3px;
    }
    footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 Terry Local Insights</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()}</div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${facets.length}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${outcomeStats.success || 0}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(satisfactionStats.happy || 0) + (satisfactionStats.satisfied || 0)}</div>
        <div class="stat-label">Happy Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${allFriction.length}</div>
        <div class="stat-label">Friction Points</div>
      </div>
    </div>

    <h2>📊 Outcome Distribution</h2>
    <div class="chart-container">
      <div class="bar-chart">
        ${Object.entries(outcomeStats)
          .map(([outcome, count]) => {
            const percent = (count / facets.length) * 100;
            return `
            <div class="bar-item">
              <div class="bar-label">${outcome}</div>
              <div class="bar-visual" style="width: ${percent}%">
                <span class="bar-count">${count}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>

    <h2>😊 Satisfaction Levels</h2>
    <div class="chart-container">
      <div class="bar-chart">
        ${Object.entries(satisfactionStats)
          .map(([level, count]) => {
            const percent = (count / facets.length) * 100;
            return `
            <div class="bar-item">
              <div class="bar-label">${level.replace(/_/g, " ")}</div>
              <div class="bar-visual" style="width: ${percent}%">
                <span class="bar-count">${count}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>

    ${
      topFriction.length > 0
        ? `
    <h2>⚠️ Top Friction Points</h2>
    <div class="chart-container">
      <div class="bar-chart">
        ${topFriction
          .map(([friction, count]) => {
            const percent = (count / allFriction.length) * 100;
            return `
            <div class="bar-item">
              <div class="bar-label">${friction}</div>
              <div class="bar-visual" style="width: ${percent}%; background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%);">
                <span class="bar-count">${count}</span>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
    `
        : ""
    }

    <h2>📝 Session Details</h2>
    ${facets
      .map(
        (facet) => `
      <div class="session-card">
        <div class="session-id">${facet.sessionId}</div>
        <div class="session-goal">${facet.goal}</div>
        <div class="session-summary">${facet.summary}</div>
        <div class="session-meta">
          <span class="badge badge-${facet.outcome}">${facet.outcome}</span>
          <span class="badge badge-${facet.satisfaction}">${facet.satisfaction.replace(/_/g, " ")}</span>
        </div>
        ${
          facet.friction.length > 0
            ? `
          <div class="friction-list">
            ${facet.friction.map((f) => `<span class="friction-item">${f}</span>`).join("")}
          </div>
        `
            : ""
        }
      </div>
    `,
      )
      .join("")}

    <footer>
      <strong>Terry CLI</strong> · Local Insights Report<br>
      Powered by Claude AI Analysis
    </footer>
  </div>
</body>
</html>
  `;

  await fs.writeFile(reportPath, html);
  return reportPath;
}
