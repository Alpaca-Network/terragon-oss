"use client";

import { useState } from "react";
import { signInWithGithub } from "@/components/auth";
import { Wordmark } from "@/components/shared/wordmark";
import {
  testimonialColumn1,
  testimonialColumn2,
} from "@/components/landing/testimonials-data";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import GridBackground from "@/components/landing/grid-background";
import Image from "next/image";
import InfiniteScrollColumn from "@/components/landing/shared/InfiniteScrollColumn";
import TestimonialCard from "@/components/landing/shared/TestimonialCard";

// Combine columns for a richer single column scroll
const allTestimonials = [...testimonialColumn1, ...testimonialColumn2];
const mobileTestimonial = testimonialColumn2[0];

// GatewayZ login URL - redirects user to GatewayZ for authentication
const GATEWAYZ_AUTH_URL =
  process.env.NEXT_PUBLIC_GATEWAYZ_URL || "https://beta.gatewayz.ai";

export default function Login({ returnUrl }: { returnUrl: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGatewayZLoading, setIsGatewayZLoading] = useState(false);

  const handleGithubSignIn = async () => {
    await signInWithGithub({
      setLoading: setIsLoading,
      returnUrl,
      location: "login_page",
    });
  };

  const handleGatewayZSignIn = () => {
    setIsGatewayZLoading(true);
    // Build the callback URL for GatewayZ to redirect back to
    const callbackUrl = new URL(
      "/api/auth/gatewayz/callback",
      window.location.origin,
    );
    callbackUrl.searchParams.set("returnUrl", returnUrl);

    // Redirect to GatewayZ auth page with callback URL
    const gatewayZAuthUrl = new URL("/auth/terragon", GATEWAYZ_AUTH_URL);
    gatewayZAuthUrl.searchParams.set("callback", callbackUrl.toString());

    window.location.href = gatewayZAuthUrl.toString();
  };

  return (
    <div className="min-h-[100dvh] w-full grid grid-cols-1 lg:grid-cols-2">
      {/* Left Side - Login Form */}
      <div className="flex flex-col p-6 md:p-12 items-center justify-center relative bg-background">
        <div className="absolute top-6 left-6 md:top-12 md:left-12">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center text-center space-y-2">
            <Wordmark showLogo showText size="lg" />
            <h1 className="text-2xl font-semibold tracking-tight mt-6">
              Welcome to Terragon
            </h1>
            <p className="text-sm text-muted-foreground">
              Log in or create an account to continue
            </p>
          </div>

          <div className="space-y-4">
            {/* Primary: GatewayZ Login */}
            <Button
              variant="default"
              size="lg"
              className="w-full relative"
              onClick={handleGatewayZSignIn}
              disabled={isGatewayZLoading || isLoading}
            >
              {isGatewayZLoading ? (
                "Redirecting to GatewayZ..."
              ) : (
                <>
                  <svg
                    className="absolute left-4 w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  Continue with GatewayZ
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* Secondary: GitHub Login (for direct GitHub auth if needed) */}
            <Button
              variant="outline"
              size="lg"
              className="w-full relative"
              onClick={handleGithubSignIn}
              disabled={isLoading || isGatewayZLoading}
            >
              {isLoading ? (
                "Signing in..."
              ) : (
                <>
                  <Image
                    src="https://cdn.terragonlabs.com/github-mark-Z5SF.svg"
                    alt="GitHub"
                    width={20}
                    height={20}
                    className="hidden dark:block absolute left-4"
                  />
                  <Image
                    src="https://cdn.terragonlabs.com/github-mark-white-Ue4J.svg"
                    alt="GitHub"
                    width={20}
                    height={20}
                    className="block dark:hidden absolute left-4"
                  />
                  Continue with GitHub
                </>
              )}
            </Button>
          </div>

          <p className="px-8 text-center text-sm text-muted-foreground">
            By clicking continue, you agree to our{" "}
            <Link
              href="/terms"
              className="underline underline-offset-4 hover:text-primary"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-primary"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Mobile Testimonial */}
        <div className="mt-12 w-full max-w-sm block lg:hidden">
          {mobileTestimonial && <TestimonialCard {...mobileTestimonial} />}
        </div>
      </div>

      {/* Right Side - Social Proof */}
      <div className="hidden lg:flex flex-col bg-muted/30 border-l border-border p-12 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <GridBackground />
        </div>
        <div className="max-w-lg space-y-6 relative z-10 w-full">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Loved by developers</h2>
            <p className="text-muted-foreground">
              Join thousands of developers building with Terragon
            </p>
          </div>

          <div className="h-[600px] overflow-hidden relative">
            <InfiniteScrollColumn
              testimonials={allTestimonials}
              speed={20}
              direction="up"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent z-10" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent z-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
