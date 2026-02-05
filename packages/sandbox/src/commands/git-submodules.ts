import { ISandboxSession } from "../types";

/**
 * Checks if a repository has git submodules by looking for .gitmodules file.
 *
 * @param session - The sandbox session
 * @param repoRoot - Optional repository root directory
 * @returns true if .gitmodules exists, false otherwise
 */
export async function hasSubmodules({
  session,
  repoRoot,
}: {
  session: ISandboxSession;
  repoRoot?: string;
}): Promise<boolean> {
  try {
    const result = await session.runCommand("test -f .gitmodules && echo yes", {
      cwd: repoRoot,
    });
    return result.trim() === "yes";
  } catch {
    return false;
  }
}

/**
 * Initializes and updates git submodules recursively with shallow clones.
 * Uses --depth=1 for faster cloning and --recursive for nested submodules.
 *
 * @param session - The sandbox session
 * @param repoRoot - Optional repository root directory
 * @returns true if submodules were initialized successfully, false if no submodules or error
 */
export async function initializeSubmodules({
  session,
  repoRoot,
}: {
  session: ISandboxSession;
  repoRoot?: string;
}): Promise<boolean> {
  const hasSubmodulesFlag = await hasSubmodules({ session, repoRoot });
  if (!hasSubmodulesFlag) {
    return false;
  }

  try {
    console.log("Initializing git submodules with shallow clones...");

    // Initialize submodules (does not clone yet, just registers them)
    await session.runCommand("git submodule init", { cwd: repoRoot });

    // Update submodules with shallow clones recursively
    // --depth=1: Only fetch the latest commit for each submodule
    // --recursive: Handle nested submodules
    // --jobs=4: Parallel clone for faster execution
    await session.runCommand(
      "git submodule update --depth=1 --recursive --jobs=4",
      { cwd: repoRoot },
    );

    console.log("Git submodules initialized successfully");
    return true;
  } catch (error) {
    console.warn("Failed to initialize submodules:", error);
    return false;
  }
}

/**
 * Updates all submodules to their latest commits as specified in the parent repository.
 * This should be called after git pull, rebase, or merge operations.
 *
 * @param session - The sandbox session
 * @param repoRoot - Optional repository root directory
 * @returns true if submodules were updated successfully, false if no submodules or error
 */
export async function updateSubmodules({
  session,
  repoRoot,
}: {
  session: ISandboxSession;
  repoRoot?: string;
}): Promise<boolean> {
  const hasSubmodulesFlag = await hasSubmodules({ session, repoRoot });
  if (!hasSubmodulesFlag) {
    return false;
  }

  try {
    console.log("Updating git submodules...");

    // Sync .gitmodules with .git/config (handles renamed/moved submodules)
    await session.runCommand("git submodule sync --recursive", {
      cwd: repoRoot,
    });

    // Update submodules to the commit specified in the parent repo
    // --init: Initialize any new submodules that weren't initialized before
    // --recursive: Update nested submodules
    // --depth=1: Keep shallow clones for performance
    // --jobs=4: Parallel updates
    await session.runCommand(
      "git submodule update --init --recursive --depth=1 --jobs=4",
      { cwd: repoRoot },
    );

    console.log("Git submodules updated successfully");
    return true;
  } catch (error) {
    console.warn("Failed to update submodules:", error);
    return false;
  }
}

/**
 * Gets the status of all submodules to check for uncommitted changes.
 * This is useful before committing to ensure submodule changes are properly tracked.
 *
 * @param session - The sandbox session
 * @param repoRoot - Optional repository root directory
 * @returns Object with hasChanges flag and list of changed submodule paths
 */
export async function getSubmoduleStatus({
  session,
  repoRoot,
}: {
  session: ISandboxSession;
  repoRoot?: string;
}): Promise<{ hasChanges: boolean; changedSubmodules: string[] }> {
  const hasSubmodulesFlag = await hasSubmodules({ session, repoRoot });
  if (!hasSubmodulesFlag) {
    return { hasChanges: false, changedSubmodules: [] };
  }

  try {
    // git submodule status shows:
    // - Space prefix: submodule is at the expected commit
    // - + prefix: submodule has a different commit than expected
    // - - prefix: submodule is not initialized
    // - U prefix: submodule has merge conflicts
    const result = await session.runCommand(
      "git submodule status --recursive",
      {
        cwd: repoRoot,
      },
    );

    const lines = result.trim().split("\n").filter(Boolean);
    const changedSubmodules: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      // Check if submodule has changes (starts with +, -, or U)
      if (
        trimmedLine.startsWith("+") ||
        trimmedLine.startsWith("-") ||
        trimmedLine.startsWith("U")
      ) {
        // Extract submodule path (third field)
        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 2) {
          changedSubmodules.push(parts[1]);
        }
      }
    }

    return {
      hasChanges: changedSubmodules.length > 0,
      changedSubmodules,
    };
  } catch (error) {
    console.warn("Failed to get submodule status:", error);
    return { hasChanges: false, changedSubmodules: [] };
  }
}

/**
 * Commits changes within submodules. This should be called before committing
 * in the parent repository when submodule contents have been modified.
 *
 * @param session - The sandbox session
 * @param commitMessage - Commit message for submodule changes
 * @param repoRoot - Optional repository root directory
 * @returns List of submodules that had changes committed
 */
export async function commitSubmoduleChanges({
  session,
  commitMessage,
  repoRoot,
}: {
  session: ISandboxSession;
  commitMessage: string;
  repoRoot?: string;
}): Promise<string[]> {
  const hasSubmodulesFlag = await hasSubmodules({ session, repoRoot });
  if (!hasSubmodulesFlag) {
    return [];
  }

  try {
    // Get list of all submodules
    const submodulesResult = await session.runCommand(
      "git submodule foreach --quiet 'echo $path'",
      { cwd: repoRoot },
    );

    const submodulePaths = submodulesResult
      .trim()
      .split("\n")
      .filter((path) => path.trim());

    const committedSubmodules: string[] = [];

    // Check each submodule for changes and commit if needed
    for (const submodulePath of submodulePaths) {
      try {
        // Check if submodule has changes
        const statusResult = await session.runCommand(
          "git status --porcelain",
          {
            cwd: repoRoot ? `${repoRoot}/${submodulePath}` : submodulePath,
          },
        );

        if (statusResult.trim()) {
          console.log(`Committing changes in submodule: ${submodulePath}`);

          // Stage all changes in submodule
          await session.runCommand("git add -A", {
            cwd: repoRoot ? `${repoRoot}/${submodulePath}` : submodulePath,
          });

          // Commit changes in submodule
          await session.runCommand(`git commit -m "${commitMessage}"`, {
            cwd: repoRoot ? `${repoRoot}/${submodulePath}` : submodulePath,
          });

          committedSubmodules.push(submodulePath);
        }
      } catch (error) {
        console.warn(
          `Failed to commit changes in submodule ${submodulePath}:`,
          error,
        );
      }
    }

    if (committedSubmodules.length > 0) {
      console.log(
        `Committed changes in ${committedSubmodules.length} submodule(s)`,
      );
    }

    return committedSubmodules;
  } catch (error) {
    console.warn("Failed to commit submodule changes:", error);
    return [];
  }
}

/**
 * Pushes submodule commits to their remote repositories.
 * This should be called after pushing the parent repository.
 *
 * @param session - The sandbox session
 * @param submodulePaths - List of submodule paths to push (from commitSubmoduleChanges)
 * @param repoRoot - Optional repository root directory
 * @returns List of submodules that were pushed successfully
 */
export async function pushSubmodules({
  session,
  submodulePaths,
  repoRoot,
}: {
  session: ISandboxSession;
  submodulePaths: string[];
  repoRoot?: string;
}): Promise<string[]> {
  if (submodulePaths.length === 0) {
    return [];
  }

  const pushedSubmodules: string[] = [];

  for (const submodulePath of submodulePaths) {
    try {
      console.log(`Pushing submodule: ${submodulePath}`);

      // Push submodule to its remote
      await session.runCommand("git push", {
        cwd: repoRoot ? `${repoRoot}/${submodulePath}` : submodulePath,
      });

      pushedSubmodules.push(submodulePath);
    } catch (error) {
      console.warn(`Failed to push submodule ${submodulePath}:`, error);
    }
  }

  if (pushedSubmodules.length > 0) {
    console.log(`Pushed ${pushedSubmodules.length} submodule(s) successfully`);
  }

  return pushedSubmodules;
}
