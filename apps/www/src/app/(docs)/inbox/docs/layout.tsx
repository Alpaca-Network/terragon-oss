import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { docsSource } from "@/lib/docs-source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={docsSource.pageTree}
      nav={{
        title: (
          <div className="flex items-center gap-2 py-2">
            GatewayZ Inbox Docs
          </div>
        ),
      }}
      sidebar={{
        collapsible: false,
      }}
    >
      {children}
    </DocsLayout>
  );
}
