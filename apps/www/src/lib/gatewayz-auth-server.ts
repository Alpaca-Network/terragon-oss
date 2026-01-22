import { cookies } from "next/headers";
import { verifyGatewayZToken, type GatewayZSession } from "./gatewayz-auth";
import { db } from "./db";
import { auth } from "./auth";
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
 * This links GatewayZ users to terragon-oss accounts.
 */
export async function findOrCreateUserFromGatewayZ(
  gwSession: GatewayZSession
): Promise<{ userId: string; isNewUser: boolean }> {
  // Look for existing user by email
  const existingUser = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, gwSession.email))
    .limit(1);

  if (existingUser.length > 0) {
    return { userId: existingUser[0].id, isNewUser: false };
  }

  // Create new user
  const newUserId = crypto.randomUUID();
  await db.insert(schema.user).values({
    id: newUserId,
    email: gwSession.email,
    name: gwSession.username,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { userId: newUserId, isNewUser: true };
}

/**
 * Create a terragon-oss session for a GatewayZ user.
 * This allows the user to interact with terragon-oss as if they logged in directly.
 */
export async function createSessionForGatewayZUser(
  gwSession: GatewayZSession
): Promise<{ sessionToken: string; userId: string }> {
  const { userId, isNewUser } = await findOrCreateUserFromGatewayZ(gwSession);

  // Create a new session using better-auth
  const session = await auth.api.createSession({
    body: {
      userId,
      expiresIn: 60 * 60, // 1 hour to match GatewayZ token
    },
  });

  return {
    sessionToken: session.token,
    userId,
  };
}
