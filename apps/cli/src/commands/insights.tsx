import React, { useEffect, useState } from "react";
import { Box, Text, useApp } from "ink";
import { useInsights } from "../hooks/useApi.js";
import { getApiKey } from "../utils/config.js";

interface InsightsCommandProps {
  numDays: number;
  timezone: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatCents(cents: number): string {
  const amount = Math.abs(cents / 100).toFixed(2);
  return cents < 0 ? `-$${amount}` : `$${amount}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

export function InsightsCommand({ numDays, timezone }: InsightsCommandProps) {
  const { exit } = useApp();
  const { data, isLoading, error } = useInsights(numDays, timezone);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const apiKey = await getApiKey();
      if (!apiKey) {
        setAuthError("Not authenticated. Run 'terry auth' first.");
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (authError) {
      exit();
    }
  }, [authError, exit]);

  useEffect(() => {
    if (error) {
      exit();
    }
  }, [error, exit]);

  useEffect(() => {
    if (!isLoading && data) {
      exit();
    }
  }, [data, isLoading, exit]);

  if (authError) {
    return (
      <Box>
        <Text color="red">Error: {authError}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">
          Error: {error instanceof Error ? error.message : String(error)}
        </Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box>
        <Text>Loading insights...</Text>
      </Box>
    );
  }

  if (!data) {
    return null;
  }

  const hasAnthropicUsage = data.costBreakdown.anthropic > 0;
  const hasOpenAIUsage = data.costBreakdown.openai > 0;
  const hasGoogleUsage = data.costBreakdown.google > 0;
  const hasOpenRouterUsage = data.costBreakdown.openrouter > 0;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>
          Usage Insights (Last {numDays} day{numDays !== 1 ? "s" : ""})
        </Text>
      </Box>

      {/* Activity Summary */}
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Activity</Text>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>Tasks Created:</Text>
          </Box>
          <Text>{formatNumber(data.totalThreadsCreated)}</Text>
        </Box>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>PRs Merged:</Text>
          </Box>
          <Text>{formatNumber(data.totalPRsMerged)}</Text>
        </Box>
      </Box>

      {/* Token Usage */}
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Token Usage</Text>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>Input Tokens:</Text>
          </Box>
          <Text>{formatTokens(data.tokenUsage.inputTokens)}</Text>
        </Box>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>Output Tokens:</Text>
          </Box>
          <Text>{formatTokens(data.tokenUsage.outputTokens)}</Text>
        </Box>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>Cached Input Tokens:</Text>
          </Box>
          <Text>{formatTokens(data.tokenUsage.cachedInputTokens)}</Text>
        </Box>
        {data.tokenUsage.cacheCreationInputTokens > 0 && (
          <Box marginLeft={2}>
            <Box width={24}>
              <Text>Cache Creation:</Text>
            </Box>
            <Text>
              {formatTokens(data.tokenUsage.cacheCreationInputTokens)}
            </Text>
          </Box>
        )}
      </Box>

      {/* Cost Breakdown */}
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Cost Breakdown</Text>
        {hasAnthropicUsage && (
          <Box marginLeft={2}>
            <Box width={24}>
              <Text>Anthropic:</Text>
            </Box>
            <Text>{formatCents(data.costBreakdown.anthropic)}</Text>
          </Box>
        )}
        {hasOpenAIUsage && (
          <Box marginLeft={2}>
            <Box width={24}>
              <Text>OpenAI:</Text>
            </Box>
            <Text>{formatCents(data.costBreakdown.openai)}</Text>
          </Box>
        )}
        {hasGoogleUsage && (
          <Box marginLeft={2}>
            <Box width={24}>
              <Text>Google:</Text>
            </Box>
            <Text>{formatCents(data.costBreakdown.google)}</Text>
          </Box>
        )}
        {hasOpenRouterUsage && (
          <Box marginLeft={2}>
            <Box width={24}>
              <Text>OpenRouter:</Text>
            </Box>
            <Text>{formatCents(data.costBreakdown.openrouter)}</Text>
          </Box>
        )}
        <Box marginLeft={2}>
          <Box width={24}>
            <Text bold>Total:</Text>
          </Box>
          <Text bold>{formatCents(data.costBreakdown.total)}</Text>
        </Box>
      </Box>

      {/* Credit Balance */}
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>Credit Balance</Text>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>Total Credits:</Text>
          </Box>
          <Text>{formatCents(data.creditBalance.totalCreditsCents)}</Text>
        </Box>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text>Used:</Text>
          </Box>
          <Text>{formatCents(data.creditBalance.totalUsageCents)}</Text>
        </Box>
        <Box marginLeft={2}>
          <Box width={24}>
            <Text bold>Remaining:</Text>
          </Box>
          <Text
            bold
            color={data.creditBalance.balanceCents > 0 ? "green" : "red"}
          >
            {formatCents(data.creditBalance.balanceCents)}
          </Text>
        </Box>
      </Box>

      {/* Daily Breakdown (last 7 days max) */}
      {data.dailyStats.length > 0 && (
        <Box flexDirection="column">
          <Text dimColor>Daily Activity (Recent)</Text>
          {data.dailyStats.slice(0, 7).map((day) => (
            <Box key={day.date} marginLeft={2}>
              <Box width={12}>
                <Text dimColor>{day.date}</Text>
              </Box>
              <Box width={16}>
                <Text>
                  {day.threadsCreated} task{day.threadsCreated !== 1 ? "s" : ""}
                </Text>
              </Box>
              <Text>
                {day.prsMerged} PR{day.prsMerged !== 1 ? "s" : ""}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
