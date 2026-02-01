"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";

const GATEWAYZ_URL =
  process.env.NEXT_PUBLIC_GATEWAYZ_URL ?? "https://beta.gatewayz.ai";

interface GatewayzConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GatewayzConnectDialog({
  open,
  onOpenChange,
}: GatewayzConnectDialogProps) {
  const handleConnect = () => {
    // Redirect to Gatewayz sign-in with return URL
    const returnUrl = encodeURIComponent(window.location.href);
    window.open(
      `${GATEWAYZ_URL}/signin?redirect_to=${returnUrl}`,
      "_blank",
      "noopener,noreferrer",
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Image
              src="/gatewayz-logo-icon.png"
              alt="Gatewayz"
              width={32}
              height={32}
            />
            <DialogTitle>Connect Gatewayz</DialogTitle>
          </div>
          <DialogDescription>
            Gatewayz Router provides unified access to multiple AI providers
            through a single subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-2">
            <h4 className="font-medium text-sm">What you get with Gatewayz:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>- Access to Claude, GPT, Gemini, and more</li>
              <li>- Single subscription for all models</li>
              <li>- Automatic failover and load balancing</li>
              <li>- Unified usage tracking</li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            Sign in to your Gatewayz account to connect your subscription.
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleConnect();
            }}
          >
            Sign in to Gatewayz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
