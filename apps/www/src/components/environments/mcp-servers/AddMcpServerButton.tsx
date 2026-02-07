"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AddMcpServerButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function AddMcpServerButton({
  onClick,
  disabled,
}: AddMcpServerButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="gap-1.5"
    >
      <Plus className="h-3.5 w-3.5" />
      Add MCP Server
    </Button>
  );
}
