"use client";

import {
  FileText,
  TestTube,
  Bug,
  BookOpen,
  Zap,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { AIModel } from "@terragon/agent/types";
import { tasksForModel, type RecommendedTask } from "./recommended-tasks.utils";
import { usePostHog } from "posthog-js/react";

interface RecommendedTasksProps {
  onTaskSelect: (prompt: string) => void;
  selectedModel?: AIModel;
}

const TASK_ICONS: Record<string, LucideIcon> = {
  "file-text": FileText,
  "test-tube": TestTube,
  bug: Bug,
  "book-open": BookOpen,
  zap: Zap,
  shield: Shield,
};

function ListRecommendedTaskItem({
  task,
  onTaskSelect,
  selectedModel,
}: {
  task: RecommendedTask;
  onTaskSelect: (prompt: string) => void;
  selectedModel?: AIModel;
}) {
  const posthog = usePostHog();
  const Icon = TASK_ICONS[task.icon] || FileText;

  const handleClick = () => {
    posthog?.capture("enhanced_task_template_clicked", {
      taskId: task.id,
      taskLabel: task.label,
      selectedModel: selectedModel,
    });

    onTaskSelect(task.prompt);
  };

  return (
    <button
      onClick={handleClick}
      className="flex items-start gap-3 py-2.5 px-2 hover:bg-muted/50 w-full rounded-md transition-colors text-left"
    >
      <Icon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{task.label}</p>
        <p className="text-xs text-muted-foreground">{task.shortDescription}</p>
      </div>
    </button>
  );
}

export function RecommendedTasks({
  onTaskSelect,
  selectedModel,
}: RecommendedTasksProps) {
  // Select tasks based on the model's agent type
  const tasks = tasksForModel(selectedModel);

  return (
    <div className="w-full">
      <div className="space-y-0">
        {tasks.map((task) => (
          <ListRecommendedTaskItem
            key={task.id}
            task={task}
            onTaskSelect={onTaskSelect}
            selectedModel={selectedModel}
          />
        ))}
      </div>
    </div>
  );
}
