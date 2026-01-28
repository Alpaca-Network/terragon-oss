import { docsSource } from "@/lib/docs-source";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";
import { createRelativeLink } from "fumadocs-ui/mdx";
import { getMDXComponents } from "@/lib/mdx-components";

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = docsSource.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(docsSource, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return docsSource.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = docsSource.getPage(params.slug);
  if (!page) notFound();

  const slug = params.slug?.join("/") || "";
  const url = slug
    ? `https://beta.gatewayz.ai/inbox/docs/${slug}`
    : "https://beta.gatewayz.ai/inbox/docs";

  return {
    title: page.data.title,
    description:
      page.data.description ||
      `Learn about ${page.data.title} in GatewayZ Inbox documentation`,
    openGraph: {
      title: page.data.title,
      description:
        page.data.description ||
        `Learn about ${page.data.title} in GatewayZ Inbox documentation`,
      url,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: page.data.title,
      description:
        page.data.description ||
        `Learn about ${page.data.title} in GatewayZ Inbox documentation`,
    },
    alternates: {
      canonical: url,
    },
  };
}
