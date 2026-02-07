import { getUserInfoOrRedirect } from "@/lib/auth-server";
import { Dashboard } from "@/components/dashboard";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/system/site-header";
import { threadListQueryOptions } from "@/queries/thread-queries";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";

export const metadata: Metadata = {
  title: "Dashboard | Gatewayz Code",
};

export const maxDuration = 800;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    archived?: string;
    backlog?: string;
  }>;
}) {
  const userInfo = await getUserInfoOrRedirect();
  if (!userInfo.userFlags.hasSeenOnboarding) {
    redirect("/welcome");
  }
  // Get the archived and backlog params
  const params = await searchParams;
  const queryClient = new QueryClient();
  const showArchived = params.archived === "true";
  const showBacklog = params.backlog === "true";
  // If archived or backlog is true, prefetch the filtered threads otherwise do nothing
  // because active threads are prefetched by the task sidebar already.
  if (showArchived) {
    await queryClient.prefetchInfiniteQuery(
      threadListQueryOptions({ archived: showArchived }),
    );
  } else if (showBacklog) {
    await queryClient.prefetchInfiniteQuery(
      threadListQueryOptions({ isBacklog: showBacklog }),
    );
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SiteHeader />
      <div className="flex-1 w-full px-4 overflow-auto">
        <Dashboard showArchived={showArchived} showBacklog={showBacklog} />
      </div>
    </HydrationBoundary>
  );
}
