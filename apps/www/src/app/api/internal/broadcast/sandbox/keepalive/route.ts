import { NextResponse } from "next/server";
import {
  getUserIdOrNull,
  getUserIdOrNullFromDaemonToken,
  getUserIdOrNullFromBearerToken,
} from "@/lib/auth-server";
import { getThreadMinimal } from "@terragon/shared/model/threads";
import { setTerminalActive } from "@/agent/sandbox-resource";
import { db } from "@/lib/db";
import { isSandboxTerminalSupported } from "@/lib/sandbox-terminal";

export async function POST(request: Request) {
  // Try multiple authentication methods:
  // 1. X-Daemon-Token header (for daemon/sandbox requests)
  // 2. Authorization: Bearer header (for PartyKit broadcast validation)
  // 3. Session cookies (for direct browser requests)
  const userId =
    (await getUserIdOrNullFromDaemonToken(request)) ??
    (await getUserIdOrNullFromBearerToken(request)) ??
    (await getUserIdOrNull());
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { threadId, sandboxId } = await request.json();
  const thread = await getThreadMinimal({ db, threadId, userId });
  if (!thread) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSandboxTerminalSupported(thread.sandboxProvider)) {
    return NextResponse.json(
      { error: "Sandbox terminal not supported for this sandbox provider" },
      { status: 400 },
    );
  }
  if (thread.codesandboxId !== sandboxId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await setTerminalActive({ sandboxId, expires: 60 * 5 }); // 5 minutes
  return NextResponse.json({ message: "ok" });
}
