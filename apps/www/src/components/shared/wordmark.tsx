"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import Link from "next/link";

type IconSize = "sm" | "md" | "lg";

export function Wordmark({
  showLogo = true,
  showText = true,
  href = "/",
  size = "md",
}: {
  showLogo?: boolean;
  showText?: boolean;
  href?: string;
  size?: IconSize;
}) {
  return (
    <Link href={href} className="flex items-center gap-2 select-none group">
      {showLogo && <WordmarkLogo size={size} />}
      {showText && (
        <span
          className={cn(
            "font-semibold text-gray-900 dark:text-gray-100",
            size === "sm" ? "text-lg" : size === "md" ? "text-lg" : "text-xl",
          )}
        >
          Gatewayz
        </span>
      )}
    </Link>
  );
}

export function WordmarkLogo({ size = "sm" }: { size?: IconSize }) {
  const dimensions = size === "sm" ? 24 : size === "md" ? 32 : 40;
  return (
    <>
      <Image
        className="block dark:hidden transition-transform group-hover:scale-105"
        src="/gatewayz-logo-black.png"
        alt="Gatewayz"
        width={dimensions}
        height={dimensions}
      />
      <Image
        className="hidden dark:block transition-transform group-hover:scale-105"
        src="/gatewayz-logo-white.png"
        alt="Gatewayz"
        width={dimensions}
        height={dimensions}
      />
    </>
  );
}
