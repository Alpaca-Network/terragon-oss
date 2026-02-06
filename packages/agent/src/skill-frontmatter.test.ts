import { describe, it, expect } from "vitest";
import {
  parseSkillFrontmatter,
  parseSkillContent,
  processSkillArguments,
} from "./skill-frontmatter";

describe("parseSkillFrontmatter", () => {
  it("should parse all frontmatter fields", () => {
    const content = `---
name: explain-code
description: Explains code with visual diagrams and analogies
argument-hint: [filename]
disable-model-invocation: true
user-invocable: false
---
# Skill content here`;

    const result = parseSkillFrontmatter(content);

    expect(result.name).toBe("explain-code");
    expect(result.description).toBe(
      "Explains code with visual diagrams and analogies",
    );
    expect(result.argumentHint).toBe("[filename]");
    expect(result.disableModelInvocation).toBe(true);
    expect(result.userInvocable).toBe(false);
  });

  it("should handle missing frontmatter", () => {
    const content = `# Just markdown content
No frontmatter here`;

    const result = parseSkillFrontmatter(content);

    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
  });

  it("should handle partial frontmatter", () => {
    const content = `---
name: my-skill
---
Content`;

    const result = parseSkillFrontmatter(content);

    expect(result.name).toBe("my-skill");
    expect(result.description).toBeUndefined();
    expect(result.disableModelInvocation).toBeUndefined();
  });

  it("should handle quoted values", () => {
    const content = `---
name: "quoted-name"
description: 'single quoted description'
---`;

    const result = parseSkillFrontmatter(content);

    expect(result.name).toBe("quoted-name");
    expect(result.description).toBe("single quoted description");
  });

  it("should parse boolean values correctly", () => {
    const content1 = `---
disable-model-invocation: true
user-invocable: yes
---`;

    const result1 = parseSkillFrontmatter(content1);
    expect(result1.disableModelInvocation).toBe(true);
    expect(result1.userInvocable).toBe(true);

    const content2 = `---
disable-model-invocation: false
user-invocable: no
---`;

    const result2 = parseSkillFrontmatter(content2);
    expect(result2.disableModelInvocation).toBe(false);
    expect(result2.userInvocable).toBe(false);
  });

  it("should parse allowed-tools as comma-separated list", () => {
    const content = `---
allowed-tools: Read, Grep, Glob
---`;

    const result = parseSkillFrontmatter(content);
    expect(result.allowedTools).toEqual(["Read", "Grep", "Glob"]);
  });
});

describe("parseSkillContent", () => {
  it("should split frontmatter and body", () => {
    const content = `---
name: test-skill
description: A test skill
---

# Skill Instructions

Do something useful.`;

    const result = parseSkillContent(content);

    expect(result.frontmatter.name).toBe("test-skill");
    expect(result.frontmatter.description).toBe("A test skill");
    expect(result.body).toContain("# Skill Instructions");
    expect(result.body).toContain("Do something useful.");
  });

  it("should handle content without frontmatter", () => {
    const content = `# Just content
No frontmatter here`;

    const result = parseSkillContent(content);

    expect(result.frontmatter.name).toBeUndefined();
    expect(result.body).toBe(content);
  });

  it("should handle frontmatter only", () => {
    const content = `---
name: minimal-skill
---`;

    const result = parseSkillContent(content);

    expect(result.frontmatter.name).toBe("minimal-skill");
    expect(result.body).toBe("");
  });
});

describe("processSkillArguments", () => {
  it("should replace $ARGUMENTS placeholder", () => {
    const body = "Process the file $ARGUMENTS";
    const result = processSkillArguments(body, "src/main.ts");

    expect(result).toBe("Process the file src/main.ts");
  });

  it("should replace positional arguments $0, $1, etc.", () => {
    const body = "Convert $0 from $1 to $2";
    const result = processSkillArguments(body, "button.tsx React Vue");

    expect(result).toBe("Convert button.tsx from React to Vue");
  });

  it("should replace $ARGUMENTS[N] format", () => {
    const body = "File: $ARGUMENTS[0], Format: $ARGUMENTS[1]";
    const result = processSkillArguments(body, "data.json yaml");

    expect(result).toBe("File: data.json, Format: yaml");
  });

  it("should replace ${CLAUDE_SESSION_ID}", () => {
    const body = "Log to logs/${CLAUDE_SESSION_ID}.log";
    const result = processSkillArguments(body, "", "session-123");

    expect(result).toBe("Log to logs/session-123.log");
  });

  it("should handle empty arguments", () => {
    const body = "Do something with $ARGUMENTS";
    const result = processSkillArguments(body, "");

    expect(result).toBe("Do something with ");
  });

  it("should handle multiple occurrences", () => {
    const body = "$ARGUMENTS is important. Remember: $ARGUMENTS";
    const result = processSkillArguments(body, "testing");

    expect(result).toBe("testing is important. Remember: testing");
  });
});
