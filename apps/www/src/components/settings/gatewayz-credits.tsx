"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Coins, Crown } from "lucide-react";
import type { GatewayZTierInfo } from "@terragon/shared/db/types";

interface GatewayZCreditsProps {
  tierInfo: GatewayZTierInfo | null;
  credits?: number | null;
  subscriptionAllowance?: number | null;
  purchasedCredits?: number | null;
  gatewayZUrl?: string;
}

/**
 * Format cents to dollars display
 */
function formatCredits(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "N/A";
  }
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get display name for GatewayZ tier
 */
function getTierDisplayName(tier: string): string {
  switch (tier) {
    case "pro":
      return "Pro";
    case "max":
      return "Max";
    default:
      return "Free";
  }
}

/**
 * GatewayZ Credits Display Component
 *
 * Shows the user's GatewayZ subscription tier and available credits.
 * Used in the billing settings page to provide visibility into GatewayZ account.
 */
export function GatewayZCredits({
  tierInfo,
  credits,
  subscriptionAllowance,
  purchasedCredits,
  gatewayZUrl = "https://gatewayz.ai",
}: GatewayZCreditsProps) {
  if (!tierInfo) return null;

  const tierDisplayName = getTierDisplayName(tierInfo.tier);

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Crown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          GatewayZ Subscription
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Plan</span>
          <span className="font-semibold">{tierDisplayName}</span>
        </div>

        {credits !== null && credits !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" />
              Available Credits
            </span>
            <span className="font-semibold">{formatCredits(credits)}</span>
          </div>
        )}

        {subscriptionAllowance !== null &&
          subscriptionAllowance !== undefined &&
          subscriptionAllowance > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Monthly Allowance
              </span>
              <span className="font-semibold">
                {formatCredits(subscriptionAllowance)}
              </span>
            </div>
          )}

        {purchasedCredits !== null &&
          purchasedCredits !== undefined &&
          purchasedCredits > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Purchased Credits
              </span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                +{formatCredits(purchasedCredits)}
              </span>
            </div>
          )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() =>
            window.open(`${gatewayZUrl}/settings/credits`, "_blank")
          }
        >
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          Manage on GatewayZ
        </Button>
      </CardContent>
    </Card>
  );
}
