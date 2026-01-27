"use client";

import { useState, useEffect } from "react";
import GridBackground from "./grid-background";
import Testimonials from "./sections/Testimonials";
import Footer from "./sections/Footer";
import BentoFeatures from "./sections/BentoFeatures";
import { Header } from "./sections/Header";
import { Hero } from "./sections/Hero";
import { SignInButtonForPreview } from "@/components/auth";
import { Pricing } from "./sections/Pricing";
import { FAQ } from "./sections/FAQ";
import CTA from "./sections/CTA";
import { HowItWorks } from "./sections/HowItWorks";
import AnnouncementBanner from "./sections/AnnouncementBanner";

interface LandingProps {
  isShutdownMode?: boolean;
  isEmbedMode?: boolean;
}

/**
 * Embed loading component with timeout handling.
 * If auth isn't received within 8 seconds, shows a helpful message
 * directing users to access via GatewayZ.
 */
function EmbedLoading() {
  const [timedOut, setTimedOut] = useState(false);
  const gatewayZInboxUrl = new URL(
    "/inbox",
    process.env.NEXT_PUBLIC_GATEWAYZ_URL ?? "https://beta.gatewayz.ai"
  ).toString();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setTimedOut(true);
    }, 8000); // 8 second timeout

    return () => clearTimeout(timeout);
  }, []);

  if (timedOut) {
    return (
      <div className="flex flex-col min-h-[100dvh] w-full relative bg-background text-foreground overflow-x-hidden items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-semibold mb-4">Session Setup Failed</h1>
          <p className="text-muted-foreground mb-6">
            Unable to establish a session. This page should be accessed through the GatewayZ app.
          </p>
          <a
            href={gatewayZInboxUrl}
            target="_top"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            Go to Coding Inbox
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[100dvh] w-full relative bg-background text-foreground overflow-x-hidden items-center justify-center">
      <div className="text-center p-8">
        <h1 className="text-2xl font-semibold mb-4">Loading...</h1>
        <p className="text-muted-foreground">
          Please wait while we set up your session.
        </p>
      </div>
    </div>
  );
}

export function Landing({ isShutdownMode, isEmbedMode }: LandingProps) {
  // In embed mode, don't show the full landing page - just show minimal loading UI
  // The embed mode is used when Terragon is embedded in GatewayZ inbox
  if (isEmbedMode) {
    return <EmbedLoading />;
  }

  return (
    <div className="flex flex-col min-h-[100dvh] w-full relative bg-background text-foreground overflow-x-hidden">
      <GridBackground />
      <Header />
      <main className="flex-1 pt-18 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <AnnouncementBanner isShutdownMode={isShutdownMode} />
        <Hero />
        <HowItWorks />
        <BentoFeatures />
        <Testimonials />
        <Pricing />
        <FAQ />
        <CTA />
        <SignInButtonForPreview />
      </main>

      <Footer />
    </div>
  );
}
