"use client";

import { useServerActionQuery } from "@/queries/server-action-helpers";
import {
  getSkillContent,
  listSkillsWithMetadata,
  getSkillDescriptionsForModel,
  type SkillContentResult,
  type SkillMetadata,
} from "@/server-actions/github-skills";

export type UseSkillContentOptions = {
  repoFullName: string;
  branchName: string;
  skillName: string;
  enabled?: boolean;
};

/**
 * Hook to fetch full skill content for invocation.
 * Only fetches when enabled and skillName is provided.
 */
export function useSkillContent({
  repoFullName,
  branchName,
  skillName,
  enabled = true,
}: UseSkillContentOptions) {
  return useServerActionQuery<SkillContentResult>({
    queryKey: ["skill-content", repoFullName, branchName, skillName],
    queryFn: () => getSkillContent({ repoFullName, branchName, skillName }),
    enabled: enabled && !!skillName && !!repoFullName && !!branchName,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export type UseSkillsListOptions = {
  repoFullName: string;
  branchName: string;
  enabled?: boolean;
};

/**
 * Hook to list all skills with their metadata.
 * Useful for populating the skill picker with enriched metadata.
 */
export function useSkillsList({
  repoFullName,
  branchName,
  enabled = true,
}: UseSkillsListOptions) {
  return useServerActionQuery<SkillMetadata[]>({
    queryKey: ["skills-list", repoFullName, branchName],
    queryFn: () => listSkillsWithMetadata({ repoFullName, branchName }),
    enabled: enabled && !!repoFullName && !!branchName,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export type UseSkillDescriptionsOptions = {
  repoFullName: string;
  branchName: string;
  enabled?: boolean;
};

/**
 * Hook to get skill descriptions for model context injection.
 * Returns only skills that can be model-invoked.
 */
export function useSkillDescriptionsForModel({
  repoFullName,
  branchName,
  enabled = true,
}: UseSkillDescriptionsOptions) {
  return useServerActionQuery<{ name: string; description: string }[]>({
    queryKey: ["skills-for-model", repoFullName, branchName],
    queryFn: () => getSkillDescriptionsForModel({ repoFullName, branchName }),
    enabled: enabled && !!repoFullName && !!branchName,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
