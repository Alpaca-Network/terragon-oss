#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  parseSkillContent,
  processSkillArguments,
} from "@terragon/agent/skill-frontmatter";

const server = new Server(
  {
    name: "terragon-mcp-server",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

const followupTaskDescription = `
Suggest a follow-up task to the user. The user will have the option to spin up another copy of Terry to run and process this task.
Give all of the context required to do this task effectively. Use this tool anytime you think there are tasks the user should do but
don't make sense to do in the current thread. Examples of these include:

- Different options of approaches a user could take to solve a problem.
- Different steps in a long term plan.
- A follow up task to a previous task in the current thread.
- If the user asks for a task suggestion.
`;

const skillDescription = `
Execute a skill within the main conversation

<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to invoke:
- Use this tool with the skill name only (no arguments)
- Examples:
  - \`skill: "pdf"\` - invoke the pdf skill
  - \`skill: "xlsx"\` - invoke the xlsx skill
  - \`skill: "ms-office-suite:pdf"\` - invoke using fully qualified name

Important:
- When a skill is relevant, you must invoke this tool IMMEDIATELY as your first action
- NEVER just announce or mention a skill in your text response without actually calling this tool
- This is a BLOCKING REQUIREMENT: invoke the relevant Skill tool BEFORE generating any other response about the task
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
</skills_instructions>

<available_skills>
{SKILLS_PLACEHOLDER}
</available_skills>
`;

/**
 * Load skill descriptions from .claude/skills/ directory.
 * Returns a formatted string of available skills.
 */
function loadAvailableSkills(): string {
  const skillsDir = path.join(process.cwd(), ".claude", "skills");

  if (!fs.existsSync(skillsDir)) {
    return "";
  }

  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills: { name: string; description: string }[] = [];

  for (const dir of skillDirs) {
    if (!dir.isDirectory()) continue;

    const skillMdPath = path.join(skillsDir, dir.name, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) continue;

    try {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      const { frontmatter } = parseSkillContent(content);

      // Skip skills with disable-model-invocation: true
      if (frontmatter.disableModelInvocation) continue;

      skills.push({
        name: frontmatter.name || dir.name,
        description: frontmatter.description || "Custom skill",
      });
    } catch (e) {
      console.error(`Failed to parse skill ${dir.name}:`, e);
    }
  }

  if (skills.length === 0) {
    return "";
  }

  return skills
    .map((skill) => `- ${skill.name}: ${skill.description}`)
    .join("\n");
}

/**
 * Validate skill name to prevent path traversal attacks.
 * Only allows alphanumeric characters, underscores, and hyphens.
 */
function isValidSkillName(skillName: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(skillName);
}

/**
 * Load skill content by name.
 */
function loadSkillContent(skillName: string): {
  content: string;
  name: string;
  description: string;
} | null {
  // Validate skill name to prevent path traversal attacks
  if (!isValidSkillName(skillName)) {
    console.error(
      `Invalid skill name "${skillName}": contains invalid characters`,
    );
    return null;
  }

  const skillPath = path.join(
    process.cwd(),
    ".claude",
    "skills",
    skillName,
    "SKILL.md",
  );

  if (!fs.existsSync(skillPath)) {
    return null;
  }

  try {
    const rawContent = fs.readFileSync(skillPath, "utf-8");
    const { frontmatter, body } = parseSkillContent(rawContent);

    return {
      content: body,
      name: frontmatter.name || skillName,
      description: frontmatter.description || "Custom skill",
    };
  } catch (e) {
    console.error(`Failed to load skill ${skillName}:`, e);
    return null;
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Load available skills to include in the Skill tool description
  const availableSkills = loadAvailableSkills();
  const skillToolDescription = skillDescription.replace(
    "{SKILLS_PLACEHOLDER}",
    availableSkills || "(no skills available)",
  );

  return {
    tools: [
      {
        name: "SuggestFollowupTask",
        description: followupTaskDescription,
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "A concise title for the follow-up task",
            },
            description: {
              type: "string",
              description:
                "A detailed description of what the follow-up task entails. Include all of the context required to do this task effectively.",
            },
          },
          required: ["title", "description"],
        },
      },
      {
        name: "PermissionPrompt",
        description: "Internal permission handler for plan mode operations.",
        inputSchema: {
          type: "object",
          properties: {
            tool_name: {
              type: "string",
              description: "The name of the tool requesting permission",
            },
          },
          required: ["tool_name"],
        },
      },
      {
        name: "Skill",
        description: skillToolDescription,
        inputSchema: {
          type: "object",
          properties: {
            skill: {
              type: "string",
              description:
                'The skill name (no arguments). E.g., "pdf" or "xlsx"',
            },
          },
          required: ["skill"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "SuggestFollowupTask": {
      return {
        content: [
          {
            type: "text",
            text: "✅ Task suggestion presented to the user.",
          },
        ],
      };
    }
    case "PermissionPrompt": {
      const { tool_name } = request.params.arguments as {
        tool_name: string;
      };

      // Log the permission request for debugging
      console.error(`Permission requested for tool "${tool_name}"`);
      // Check if this is for ExitPlanMode
      if (tool_name === "ExitPlanMode") {
        // For ExitPlanMode, return a user-friendly message
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                behavior: "deny",
                message: "✏️ User is reviewing the plan.",
              }),
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              behavior: "deny",
              message: `Unexpected tool "${tool_name}" requested permission. Only ExitPlanMode is supported.\n\n${JSON.stringify(request.params.arguments)}`,
            }),
          },
        ],
      };
    }
    case "Skill": {
      const { skill: skillName } = request.params.arguments as {
        skill: string;
      };

      console.error(`Skill invoked: "${skillName}"`);

      // Load the skill content
      const skillData = loadSkillContent(skillName);

      if (!skillData) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Skill "${skillName}" not found. Make sure it exists in .claude/skills/${skillName}/SKILL.md`,
            },
          ],
          isError: true,
        };
      }

      // Process the skill content (no arguments for model invocation)
      const processedContent = processSkillArguments(
        skillData.content,
        "",
        undefined,
      );

      return {
        content: [
          {
            type: "text",
            text: `# Skill: ${skillData.name}

${skillData.description}

---

${processedContent}`,
          },
        ],
      };
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
