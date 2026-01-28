import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.terragonlabs.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    reactCompiler: true,
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    // CORS headers for GatewayZ integration
    return [
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value:
              process.env.GATEWAYZ_ALLOWED_ORIGINS ||
              "https://gatewayz.ai,https://beta.gatewayz.ai,https://www.gatewayz.ai",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-GatewayZ-Session",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/relay-WkjS/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/relay-WkjS/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/relay-WkjS/flags",
        destination: "https://us.i.posthog.com/flags",
      },
    ];
  },
  async redirects() {
    return [
      // Backward compatibility: redirect /chat/:id to /task/:id
      {
        source: "/chat/:id",
        destination: "/task/:id",
        permanent: false,
      },
      // Docs redirects for legacy paths
      {
        source: "/inbox/docs/release-notes",
        destination: "/inbox/docs/resources/release-notes",
        permanent: true,
      },
      {
        source: "/inbox/docs/tasks/automations",
        destination: "/inbox/docs/automations",
        permanent: true,
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default withMDX(nextConfig);
