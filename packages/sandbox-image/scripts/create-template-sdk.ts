import type { SandboxProvider, SandboxSize } from "@terragon/types/sandbox";
import { Daytona, Image } from "@daytonaio/sdk";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { renderDockerfile } from "../src/render-dockerfile";

// Parse command line arguments for CPU/memory configuration
const args = process.argv.slice(2);
const sizeArg = args.find((arg) => arg.startsWith("--size="));
const providerArg = args.find((arg) => arg.startsWith("--provider="));
const size = sizeArg?.split("=")[1] as SandboxSize | undefined;
const provider = providerArg?.split("=")[1] as SandboxProvider | undefined;
const templatesJsonPath = path.join(__dirname, "../templates.json");
const dockerfileHbsPath = path.join(__dirname, "../Dockerfile.hbs");
const isProd = process.env.NODE_ENV === "production";
const namePrefix = isProd ? "terry" : "terry-dev";

type TemplateArgs = {
  cpuCount: number;
  memoryGB: number;
};

function randomSuffix() {
  const dateString = new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, "-");
  const hex = Math.random().toString(36).substring(2, 8);
  return `${dateString}-${hex}`;
}

function getTemplateName({ cpuCount, memoryGB }: TemplateArgs): string {
  return `${namePrefix}-vCPU-${cpuCount}-RAM-${memoryGB}GB-${randomSuffix()}`;
}

function getDockerfileHash(): string {
  const dockerfileHbsContent = fs.readFileSync(dockerfileHbsPath, "utf-8");
  return crypto.createHash("sha256").update(dockerfileHbsContent).digest("hex");
}

function getDockerfilePath(provider: SandboxProvider): string {
  return path.join(__dirname, `../Dockerfile.${provider}`);
}

async function buildDaytonaTemplateWithSdk(templateArgs: TemplateArgs) {
  const apiKey = process.env.DAYTONA_API_KEY;
  if (!apiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is required");
  }

  const daytona = new Daytona({ apiKey });
  const name = getTemplateName(templateArgs);

  // Render the Dockerfile for daytona
  const dockerfileContent = renderDockerfile("daytona");
  const dockerfilePath = getDockerfilePath("daytona");
  fs.writeFileSync(dockerfilePath, dockerfileContent);

  console.log(`Creating Daytona snapshot: ${name}`);
  console.log(`Using Dockerfile from: ${dockerfilePath}`);
  console.log(
    `Resources: ${templateArgs.cpuCount} vCPU, ${templateArgs.memoryGB}GB RAM`,
  );

  // Create Image from Dockerfile
  const image = Image.fromDockerfile(dockerfilePath);

  // Create snapshot using SDK
  const snapshot = await daytona.snapshot.create(
    {
      name,
      image,
      resources: {
        cpu: templateArgs.cpuCount,
        memory: templateArgs.memoryGB, // Memory in GiB
        disk: 20, // 20 GiB
      },
    },
    {
      onLogs: (chunk: string) => {
        process.stdout.write(chunk);
      },
      timeout: 600, // 10 minutes
    },
  );

  console.log(`Snapshot created successfully: ${snapshot.name || name}`);
  return snapshot.name || name;
}

async function updateTemplatesJson({
  templateName,
  dockerfileHash,
  cpuCount,
  memoryGB,
  provider,
  size,
}: {
  templateName: string;
  dockerfileHash: string;
  cpuCount: number;
  memoryGB: number;
  provider: SandboxProvider;
  size: SandboxSize;
}) {
  let templates: any[] = [];
  if (fs.existsSync(templatesJsonPath)) {
    const content = fs.readFileSync(templatesJsonPath, "utf-8");
    templates = JSON.parse(content);
  }
  // Add or update the template entry
  templates.push({
    name: templateName,
    dockerfileHash,
    cpuCount,
    memoryGB,
    provider,
    size,
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(templatesJsonPath, JSON.stringify(templates, null, 2));
}

async function main() {
  if (!size) {
    throw new Error("Size is required (--size=small or --size=large)");
  }
  if (provider !== "daytona") {
    throw new Error(
      "This script only supports Daytona provider (--provider=daytona)",
    );
  }

  const cpuCount = size === "large" ? 4 : 2;
  const memoryGB = size === "large" ? 8 : 4;
  const dockerfileHash = getDockerfileHash();

  console.log(`Creating ${provider} template for ${size} size...`);
  console.log(` * CPU: ${cpuCount} vCPU`);
  console.log(` * Memory: ${memoryGB}GB`);
  console.log(` * Dockerfile hash: ${dockerfileHash}`);

  const startTime = Date.now();
  const templateName = await buildDaytonaTemplateWithSdk({
    cpuCount,
    memoryGB,
  });

  await updateTemplatesJson({
    templateName,
    dockerfileHash,
    cpuCount,
    memoryGB,
    provider,
    size,
  });

  console.log(`Successfully created template: ${templateName}`, {
    cpuCount,
    memoryGB,
    dockerfileHash,
    provider,
    size,
    durationMs: Date.now() - startTime,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
