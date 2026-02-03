import {
  Rocket,
  Server,
  Zap,
  Package,
  Briefcase,
  Box,
  Layout,
  FileCode,
  type LucideIcon,
} from "lucide-react";

export interface TemplateRepo {
  id: string;
  name: string;
  description: string;
  githubOwner: string | null;
  githubRepo: string | null;
  language: string;
  icon: LucideIcon;
  suggestedFirstTask: string;
}

export const TEMPLATE_REPOS: TemplateRepo[] = [
  {
    id: "nextjs-app",
    name: "Next.js App",
    description: "React framework with TypeScript",
    githubOwner: "vercel",
    githubRepo: "next.js",
    language: "TypeScript",
    icon: Rocket,
    suggestedFirstTask:
      "Set up authentication with NextAuth and add a login page",
  },
  {
    id: "express-api",
    name: "Express API",
    description: "Node.js REST API with TypeScript",
    githubOwner: "microsoft",
    githubRepo: "TypeScript-Node-Starter",
    language: "TypeScript",
    icon: Server,
    suggestedFirstTask: "Add a new API endpoint for user management",
  },
  {
    id: "python-fastapi",
    name: "Python FastAPI",
    description: "Modern Python web framework",
    githubOwner: "tiangolo",
    githubRepo: "full-stack-fastapi-template",
    language: "Python",
    icon: Zap,
    suggestedFirstTask: "Create a new API endpoint with database integration",
  },
  {
    id: "react-library",
    name: "React Library",
    description: "Component library starter",
    githubOwner: "alexeagleson",
    githubRepo: "template-react-component-library",
    language: "TypeScript",
    icon: Package,
    suggestedFirstTask: "Create your first reusable component with Storybook",
  },
  {
    id: "slick-portfolio",
    name: "Slick Portfolio",
    description: "Svelte portfolio template",
    githubOwner: "RiadhAdrani",
    githubRepo: "slick-portfolio-svelte",
    language: "Svelte",
    icon: Briefcase,
    suggestedFirstTask:
      "Customize the portfolio with your personal information and projects",
  },
  {
    id: "node-module",
    name: "Node Module",
    description: "npm package boilerplate",
    githubOwner: "sindresorhus",
    githubRepo: "node-module-boilerplate",
    language: "JavaScript",
    icon: Box,
    suggestedFirstTask: "Implement your first module function and add tests",
  },
  {
    id: "cresset",
    name: "Cresset",
    description: "Web app template",
    githubOwner: "cresset-template",
    githubRepo: "cresset",
    language: "TypeScript",
    icon: Layout,
    suggestedFirstTask: "Customize the theme and add your first feature",
  },
  {
    id: "blank",
    name: "Blank Repository",
    description: "Start from scratch",
    githubOwner: null,
    githubRepo: null,
    language: "None",
    icon: FileCode,
    suggestedFirstTask:
      "Set up your project structure and initial configuration",
  },
];
