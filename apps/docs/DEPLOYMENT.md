# Docs Deployment Guide

## Overview

The standalone documentation site (`apps/docs`) is configured to be deployed separately from the main application at `docs.terragonlabs.com`.

## Build Configuration

### Files Created/Modified

1. **`vercel.json`** - Vercel deployment configuration

   - Specifies build command and output directory
   - Uses standard Next.js build (not static export) for server-side generation

2. **`.env.example`** - Updated with deployment guidance

   - `NEXT_PUBLIC_APP_URL` should be set to `https://docs.terragonlabs.com` in production

3. **`packages/env/src/next-public.ts`** - Updated `publicDocsUrl()` function
   - Returns base URL only (call sites append `/docs` or specific paths)
   - Development: `http://localhost:3001` (docs run on port 3001)
   - Production: `https://docs.terragonlabs.com`

## Deployment Steps

### 1. Vercel Setup

Deploy the docs site as a separate Vercel project:

```bash
# From the root of the monorepo
cd apps/docs
vercel --prod
```

### 2. Environment Variables

Set in Vercel project settings:

```bash
NEXT_PUBLIC_APP_URL=https://docs.terragonlabs.com
```

### 3. Domain Configuration

In Vercel:

1. Go to Project Settings → Domains
2. Add custom domain: `docs.terragonlabs.com`
3. Configure DNS records as instructed by Vercel

## Integration with Main App

The main application (`apps/www`) references the docs site via:

- `publicDocsUrl()` function from `@terragon/env/next-public`
- Used in landing page components (Header, Hero, Footer)
- Can be overridden with `NEXT_PUBLIC_DOCS_URL` environment variable

## Content Synchronization

The docs content is duplicated between:

- `apps/www/content/docs` - Embedded docs in main app
- `apps/docs/content/docs` - Standalone docs site

Key differences:

- `meta.json` has different branding
  - www: "Using GatewayZ Inbox"
  - docs: "Using Terragon"

## Build Commands

```bash
# Build docs only
pnpm -C apps/docs build

# Build entire monorepo (includes docs)
pnpm build

# Development
pnpm -C apps/docs dev  # Runs on port 3001
```

## Verification

After deployment, verify:

1. All routes are accessible at `/docs/*`
2. Search functionality works (`/api/search`)
3. Static assets load correctly
4. Navigation and linking work properly

## Routes Generated

The build generates static pages for all documentation:

- `/docs` - Index page
- `/docs/quick-start`
- `/docs/automations`
- `/docs/agent-providers/*`
- `/docs/configuration/*`
- `/docs/integrations/*`
- `/docs/resources/*`
- `/docs/tasks/*`

## Notes

- The docs site uses Fumadocs for documentation framework
- Static generation is handled by Next.js App Router
- MDX files are processed during build time
- The site is fully static and can be deployed to any static hosting
