"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * GlowCard - A card component with futuristic glow effects
 */
interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowOnHover?: boolean;
  glowIntensity?: "subtle" | "medium" | "strong";
  children: React.ReactNode;
}

export function GlowCard({
  className,
  glowOnHover = true,
  glowIntensity = "medium",
  children,
  ...props
}: GlowCardProps) {
  const intensityClasses = {
    subtle: "hover:shadow-[0_0_15px_hsl(var(--primary)/0.15)]",
    medium: "hover:shadow-[0_0_25px_hsl(var(--primary)/0.25)]",
    strong: "hover:shadow-[0_0_35px_hsl(var(--primary)/0.35)]",
  };

  return (
    <div
      className={cn(
        "relative rounded-lg transition-all duration-300",
        glowOnHover && intensityClasses[glowIntensity],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * NeonBorder - Wrapper that adds an animated neon border effect
 */
interface NeonBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
  color?: "primary" | "accent" | "gradient";
  children: React.ReactNode;
}

export function NeonBorder({
  className,
  animated = false,
  color = "primary",
  children,
  ...props
}: NeonBorderProps) {
  const colorClasses = {
    primary: "before:bg-primary/50",
    accent: "before:bg-accent/50",
    gradient:
      "before:bg-gradient-to-r before:from-primary/50 before:via-accent/30 before:to-primary/50",
  };

  return (
    <div
      className={cn(
        "relative rounded-lg",
        "before:absolute before:inset-0 before:rounded-lg before:p-[1px]",
        "before:-z-10 before:bg-gradient-to-r",
        colorClasses[color],
        animated && "animated-gradient-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * PulseIndicator - A pulsing status indicator
 */
interface PulseIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  status?: "active" | "pending" | "success" | "error";
  size?: "sm" | "md" | "lg";
}

export function PulseIndicator({
  className,
  status = "active",
  size = "md",
  ...props
}: PulseIndicatorProps) {
  const statusColors = {
    active: "bg-primary",
    pending: "bg-accent",
    success: "bg-primary",
    error: "bg-destructive",
  };

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  const pulseColors = {
    active: "bg-primary/50",
    pending: "bg-accent/50",
    success: "bg-primary/50",
    error: "bg-destructive/50",
  };

  return (
    <span
      className={cn("relative inline-flex", sizeClasses[size], className)}
      {...props}
    >
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          pulseColors[status],
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-full w-full rounded-full",
          statusColors[status],
        )}
      />
    </span>
  );
}

/**
 * GlassPanel - A glassmorphism panel component
 */
interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  blur?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function GlassPanel({
  className,
  blur = "md",
  children,
  ...props
}: GlassPanelProps) {
  const blurClasses = {
    sm: "backdrop-blur-sm",
    md: "backdrop-blur-md",
    lg: "backdrop-blur-lg",
  };

  return (
    <div
      className={cn(
        "bg-background/80 dark:bg-background/60",
        blurClasses[blur],
        "border border-border/50",
        "rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * ScanLine - An animated scan line effect overlay
 */
interface ScanLineProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
}

export function ScanLine({
  className,
  active = true,
  ...props
}: ScanLineProps) {
  if (!active) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      {...props}
    >
      <div className="absolute inset-x-0 h-px animate-[scan-line_3s_linear_infinite] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
    </div>
  );
}

/**
 * HolographicBadge - A badge with holographic shimmer effect
 */
interface HolographicBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function HolographicBadge({
  className,
  children,
  ...props
}: HolographicBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        "holographic-bg",
        "border border-primary/20",
        "text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * CyberButton - A futuristic styled button with glow effects
 */
interface CyberButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  glowing?: boolean;
  children: React.ReactNode;
}

export function CyberButton({
  className,
  variant = "primary",
  size = "md",
  glowing = false,
  children,
  ...props
}: CyberButtonProps) {
  const variantClasses = {
    primary: cn(
      "bg-primary text-primary-foreground",
      "hover:bg-primary/90",
      glowing && "animate-neon-pulse",
    ),
    secondary: cn(
      "bg-secondary text-secondary-foreground",
      "hover:bg-secondary/80",
      "border border-border",
    ),
    ghost: cn(
      "bg-transparent text-foreground",
      "hover:bg-accent/10",
      "border border-transparent hover:border-primary/30",
    ),
  };

  const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button
      className={cn(
        "relative inline-flex items-center justify-center gap-2",
        "rounded-lg font-medium",
        "transition-all duration-300",
        "tap-highlight soft-glow",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * DataStreamLoader - A futuristic loading indicator
 */
interface DataStreamLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function DataStreamLoader({
  className,
  size = "md",
  ...props
}: DataStreamLoaderProps) {
  const sizeClasses = {
    sm: "h-1 w-16",
    md: "h-1.5 w-24",
    lg: "h-2 w-32",
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full bg-muted",
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      <div className="h-full w-full data-stream bg-gradient-to-r from-transparent via-primary to-transparent" />
    </div>
  );
}

/**
 * FuturisticDivider - A styled divider with glow effect
 */
interface FuturisticDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export function FuturisticDivider({
  className,
  orientation = "horizontal",
  ...props
}: FuturisticDividerProps) {
  return (
    <div
      className={cn(
        "bg-gradient-to-r from-transparent via-primary/30 to-transparent",
        orientation === "horizontal" ? "h-px w-full" : "w-px h-full",
        className,
      )}
      {...props}
    />
  );
}

/**
 * FloatingCard - A card that appears to float with subtle animation
 */
interface FloatingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  children: React.ReactNode;
}

export function FloatingCard({
  className,
  elevated = false,
  children,
  ...props
}: FloatingCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-card border border-border",
        "transition-all duration-300",
        "card-float-hover",
        elevated && "shadow-lg shadow-primary/5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * AnimatedEntrance - Wrapper for entrance animations
 */
interface AnimatedEntranceProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
  children: React.ReactNode;
}

export function AnimatedEntrance({
  className,
  delay = 0,
  children,
  style,
  ...props
}: AnimatedEntranceProps) {
  return (
    <div
      className={cn("animate-card-enter opacity-0", className)}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: "forwards",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
