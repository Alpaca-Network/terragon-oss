/**
 * Built-in templates for backlog items
 * These provide structured prompts for common task types
 */

export interface BacklogTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isBuiltIn: boolean;
}

export const BUILT_IN_TEMPLATES: BacklogTemplate[] = [
  {
    id: "feature-prd",
    name: "Feature PRD",
    description: "Structured template for new feature development",
    isBuiltIn: true,
    prompt: `## Feature: [Feature Name]

### Problem Statement
[Describe the problem this feature solves]

### Proposed Solution
[Describe the high-level solution]

### User Stories
- As a [user type], I want to [action] so that [benefit]

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Technical Considerations
[Any technical constraints or considerations]

### Out of Scope
[What this feature does NOT include]`,
  },
  {
    id: "bug-investigation",
    name: "Bug Investigation",
    description: "Template for investigating and fixing bugs",
    isBuiltIn: true,
    prompt: `## Bug: [Brief Description]

### Expected Behavior
[What should happen]

### Actual Behavior
[What is happening instead]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Environment
- Browser/OS: [if applicable]
- Version: [if applicable]

### Additional Context
[Screenshots, error messages, logs, etc.]`,
  },
  {
    id: "code-review",
    name: "Code Review Request",
    description: "Template for requesting code review",
    isBuiltIn: true,
    prompt: `## Code Review Request

### Files/Areas to Review
[List the files or areas that need review]

### Context
[Brief explanation of what changes were made and why]

### Specific Questions
- [Any specific areas you'd like feedback on]

### Testing Done
[How the changes were tested]

### Checklist
- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated (if needed)`,
  },
  {
    id: "documentation-update",
    name: "Documentation Update",
    description: "Template for documentation changes",
    isBuiltIn: true,
    prompt: `## Documentation Update

### What needs documenting
[Describe what needs to be documented]

### Target Audience
[Who will read this documentation]

### Sections to Update/Create
- [ ] [Section 1]
- [ ] [Section 2]

### Related Code/Features
[Link to related code or features being documented]`,
  },
  {
    id: "refactoring-task",
    name: "Refactoring Task",
    description: "Template for code refactoring",
    isBuiltIn: true,
    prompt: `## Refactoring: [Area/Component]

### Current State
[Describe the current implementation and its issues]

### Proposed Changes
[Describe what changes should be made]

### Goals
- [ ] [Goal 1 - e.g., Improve readability]
- [ ] [Goal 2 - e.g., Reduce duplication]
- [ ] [Goal 3 - e.g., Better separation of concerns]

### Risk Assessment
[Any risks or things to watch out for]

### Testing Strategy
[How to verify the refactoring doesn't break anything]`,
  },
];

/**
 * Get all available templates (built-in + custom)
 * Custom templates would be loaded from user storage
 */
export function getAllTemplates(
  customTemplates: BacklogTemplate[] = [],
): BacklogTemplate[] {
  return [...BUILT_IN_TEMPLATES, ...customTemplates];
}

/**
 * Get a template by ID
 */
export function getTemplateById(
  id: string,
  customTemplates: BacklogTemplate[] = [],
): BacklogTemplate | undefined {
  return getAllTemplates(customTemplates).find((t) => t.id === id);
}

/**
 * Create a new custom template
 */
export function createCustomTemplate(
  name: string,
  description: string,
  prompt: string,
): BacklogTemplate {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    prompt,
    isBuiltIn: false,
  };
}
