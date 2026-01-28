"use client";

import { useState, useEffect } from "react";
import { MenuIcon } from "lucide-react";
import { Wordmark } from "@/components/shared/wordmark";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { publicDocsUrl } from "@terragon/env/next-public";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 w-full z-50 bg-white dark:bg-background border-b border-gray-200 dark:border-border transition-shadow duration-300 ${scrolled ? "shadow-md" : ""}`}
    >
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4 max-w-6xl mx-auto">
        {/* Logo */}
        <Wordmark size="sm" />

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-6 text-sm mt-0.5">
          <a
            href="#how-it-works"
            className="text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors font-medium"
          >
            How It Works
          </a>
          <a
            href="#features"
            className="text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors font-medium"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors font-medium"
          >
            Pricing
          </a>
          <a
            href={publicDocsUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors font-medium"
          >
            Documentation
          </a>
        </nav>

        <div className="flex-1" />
        {/* Login Button - Desktop */}
        <div className="hidden md:block">
          <Button
            variant="default"
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90"
          >
            <Link href="/login">Sign In</Link>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-accent rounded-md transition-colors text-gray-900 dark:text-foreground">
              <MenuIcon className="size-5" />
              <span className="sr-only">Open menu</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-64 bg-white dark:bg-background border-gray-200 dark:border-border"
          >
            <nav className="flex flex-col gap-6 mt-8">
              <a
                href="#how-it-works"
                className="text-sm font-medium text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <a
                href="#features"
                className="text-sm font-medium text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <a
                href={publicDocsUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-600 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Documentation
              </a>
              <Button
                variant="default"
                className="w-full bg-primary hover:bg-primary/90"
                asChild
                size="lg"
              >
                <Link href="/login">Sign In</Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
