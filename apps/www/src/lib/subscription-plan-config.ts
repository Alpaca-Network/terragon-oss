export type SubscriptionPlanId = "core" | "pro" | "enterprise";

export interface SubscriptionPlanConfig {
  id: SubscriptionPlanId;
  name: string;
  price: string;
  period?: string;
  description: string;
  billingBlurb?: string;
  features: string[];
  badge?: string;
}

export const SUBSCRIPTION_PLAN_CONFIG: Record<
  SubscriptionPlanId,
  SubscriptionPlanConfig
> = {
  core: {
    id: "core",
    name: "Pro", // Displayed as "Pro" (formerly "Core")
    price: "$8",
    period: "per month",
    description:
      "Ideal for individuals who want to orchestrate multiple agents.",
    billingBlurb: "For individuals",
    features: [
      "Hosted Sandboxes (2 CPU, 4GB RAM)",
      "3 concurrent tasks",
      "5 automations",
      "GitHub integration",
      "Slack integration",
      "Connect ChatGPT or Claude subscription",
    ],
  },
  pro: {
    id: "pro",
    name: "Max", // Displayed as "Max" (formerly "Pro")
    price: "$75",
    period: "per month",
    description:
      "Built for power users who need more throughput and larger sandboxes.",
    billingBlurb: "For power users",
    features: [
      "Hosted Sandboxes (2 CPU, 4GB RAM)",
      "10 concurrent tasks",
      "Unlimited automations",
      "GitHub integration",
      "Slack integration",
      "Connect ChatGPT or Claude subscription",
      "Larger Sandboxes (Coming soon)",
      "REST API access (Coming soon)",
    ],
    badge: "Recommended",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: "Contact us",
    description: "For teams",
    features: [
      "Bring Your Own Sandboxes",
      "Team Automations",
      "Team Environments",
      "Custom Integrations",
    ],
  },
};
