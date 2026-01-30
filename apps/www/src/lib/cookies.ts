export const timeZoneKey = "timeZone";
export const threadListCollapsedSectionsKey = "thread-list-collapsed-sections";
export const disableGitCheckpointingKey = "disable-git-checkpointing";
export const skipSetupKey = "skip-setup";
export const createNewBranchKey = "create-new-branch";
export const threadListGroupByKey = "thread-list-group-by";
export const repositoryCollapsedSectionsKey = "repository-collapsed-sections";
export const threadListCollapsedKey = "thread-list-collapsed";
export const secondaryPaneClosedKey = "secondary-panel-closed";
export const secondaryPanelViewKey = "secondary-panel-view";
export const dashboardViewModeKey = "dashboard-view-mode";

export type ThreadListGroupBy = "lastUpdated" | "repository" | "createdAt";
export type DashboardViewMode = "list" | "kanban";

export const defaultDashboardViewMode: DashboardViewMode = "list";

export type SecondaryPanelView =
  | "files-changed"
  | "comments"
  | "checks"
  | "coverage"
  | "merge";
export const defaultSecondaryPanelView: SecondaryPanelView = "files-changed";

export type CollapsedSections = {
  [key: string]: boolean;
};

export const defaultCollapsedSections: CollapsedSections = {};

export const defaultThreadListGroupBy: ThreadListGroupBy = "lastUpdated";

// Here we store cookies that are device specific that we don't want to be across devices.
export type UserCookies = {
  [timeZoneKey]?: string;
  [threadListGroupByKey]?: ThreadListGroupBy;
  [threadListCollapsedSectionsKey]?: CollapsedSections;
  [disableGitCheckpointingKey]?: boolean;
  [skipSetupKey]?: boolean;
  [createNewBranchKey]?: boolean;
  [threadListCollapsedKey]?: boolean;
  [secondaryPaneClosedKey]?: boolean;
  [secondaryPanelViewKey]?: SecondaryPanelView;
  [dashboardViewModeKey]?: DashboardViewMode;
};

export const defaultTimeZone = "UTC";

export const getDefaultUserCookies = (): UserCookies => {
  return {
    [timeZoneKey]: defaultTimeZone,
    [threadListCollapsedSectionsKey]: defaultCollapsedSections,
    [disableGitCheckpointingKey]: false,
    [skipSetupKey]: false,
    [createNewBranchKey]: true,
    [threadListGroupByKey]: defaultThreadListGroupBy,
    [threadListCollapsedKey]: false,
    [secondaryPaneClosedKey]: false,
    [secondaryPanelViewKey]: defaultSecondaryPanelView,
    [dashboardViewModeKey]: defaultDashboardViewMode,
  };
};

// Cookie expiration: 1 year in seconds
export const COOKIE_MAX_AGE_SECS = 60 * 60 * 24 * 365;
