import { useCallback } from "react";
import { useAtom, useAtomValue } from "jotai";
import {
  threadListCollapsedAtom,
  dashboardViewModeAtom,
} from "@/atoms/user-cookies";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar";

export function useCollapsibleThreadList() {
  const { isMobile } = useSidebar();
  const pathname = usePathname();
  const viewMode = useAtomValue(dashboardViewModeAtom);
  const [isThreadListCollapsedCookie, setIsThreadListCollapsedCookie] = useAtom(
    threadListCollapsedAtom,
  );
  // Allow collapse on dashboard when in kanban view mode
  const isDashboardKanban = pathname === "/dashboard" && viewMode === "kanban";
  const canCollapseThreadList =
    !isMobile && (pathname !== "/dashboard" || isDashboardKanban);
  const setThreadListCollapsed = useCallback(
    (collapsed: boolean) => {
      if (canCollapseThreadList) {
        setIsThreadListCollapsedCookie(collapsed);
      }
    },
    [canCollapseThreadList, setIsThreadListCollapsedCookie],
  );
  return {
    canCollapseThreadList,
    isThreadListCollapsed: canCollapseThreadList && isThreadListCollapsedCookie,
    setThreadListCollapsed,
    isDashboardKanban,
  };
}
