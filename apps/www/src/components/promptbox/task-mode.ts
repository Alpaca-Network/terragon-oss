export type TaskMode = "execute" | "plan" | "loop" | "template";
export type PermissionMode = "allowAll" | "plan" | "loop";

export function taskModeFromPermissionMode(mode: PermissionMode): TaskMode {
  switch (mode) {
    case "allowAll":
      return "execute";
    case "plan":
      return "plan";
    case "loop":
      return "loop";
    default:
      return "execute";
  }
}

export function permissionModeFromTaskMode(mode: TaskMode): PermissionMode {
  switch (mode) {
    case "execute":
      return "allowAll";
    case "plan":
      return "plan";
    case "loop":
      return "loop";
    case "template":
      return "plan";
    default:
      return "allowAll";
  }
}

export function buildTemplateDoc(text: string) {
  const lines = text.split("\n");
  return {
    type: "doc",
    content: lines.map((line) =>
      line.length > 0
        ? { type: "paragraph", content: [{ type: "text", text: line }] }
        : { type: "paragraph", content: [] },
    ),
  } as const;
}
