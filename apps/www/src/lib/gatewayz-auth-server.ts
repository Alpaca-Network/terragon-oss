import { cookies } from "next/headers";
import { verifyGatewayZToken, type GatewayZSession } from "./gatewayz-auth";
import { db } from "./db";
import * as schema from "@terragon/shared/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get GatewayZ session from cookie (server-side)
 */
export async function getGatewayZSessionFromCookie(): Promise<GatewayZSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("gw_auth_token")?.value;

  if (!token) {
    return null;
  }

  return verifyGatewayZToken(token);
}

/**
 * Check if we're in GatewayZ embed mode
 */
export async function isGatewayZEmbedMode(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("gw_embed_mode")?.value === "true";
}

/**
 * Find or create a terragon-oss user from a GatewayZ session.
 * This links GatewayZ users to terragon-oss accounts and syncs their tier.
 */
export async function findOrCreateUserFromGatewayZ(
  gwSession: GatewayZSession,
): Promise<{ userId: string; isNewUser: boolean }> {
  const now = new Date();
  // Normalize tier - treat undefined/null as 'free'
  const gwTier = (gwSession.tier || "free") as "free" | "pro" | "max";

  // Look for existing user by email
  const existingUser = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, gwSession.email))
    .limit(1);

  const firstUser = existingUser[0];
  if (firstUser) {
    // Update GatewayZ fields on existing user
    await db
      .update(schema.user)
      .set({
        gwUserId: String(gwSession.gwUserId),
        gwTier,
        gwTierUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(schema.user.id, firstUser.id));

    return { userId: firstUser.id, isNewUser: false };
  }

  // Create new user with GatewayZ fields
  const newUserId = crypto.randomUUID();
  await db.insert(schema.user).values({
    id: newUserId,
    email: gwSession.email,
    name: gwSession.username,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    gwUserId: String(gwSession.gwUserId),
    gwTier,
    gwTierUpdatedAt: now,
  });

  return { userId: newUserId, isNewUser: true };
}

/**
 * Create a terragon-oss session for a GatewayZ user.
 * This allows the user to interact with terragon-oss as if they logged in directly.
 */
export async function createSessionForGatewayZUser(
  gwSession: GatewayZSession,
): Promise<{ sessionToken: string; userId: string }> {
  const { userId } = await findOrCreateUserFromGatewayZ(gwSession);

  // Create a new session directly in the database
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();
  const now = new Date();
  // 60 days expiry to match Better Auth session config
  const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  await db.insert(schema.session).values({
    id: sessionId,
    token: sessionToken,
    userId,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return {
    sessionToken,
    userId,
  };
}

/**
 * Connect a GatewayZ account to an existing user.
 * Used when an already logged-in user wants to link their GatewayZ subscription.
 */
export async function connectGatewayZToExistingUser(
  userId: string,
  gwSession: GatewayZSession,
): Promise<void> {
  const now = new Date();
  // Normalize tier - treat undefined/null as 'free'
  const gwTier = (gwSession.tier || "free") as "free" | "pro" | "max";

  await db
    .update(schema.user)
    .set({
      gwUserId: String(gwSession.gwUserId),
      gwTier,
      gwTierUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(schema.user.id, userId));
}
