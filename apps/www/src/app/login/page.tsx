import { getUserIdOrNull } from "@/lib/auth-server";
import { validateReturnUrl } from "@/lib/url-validation";
import { publicAppUrl } from "@terragon/env/next-public";
import { redirect } from "next/navigation";
import Login from "./login";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Gatewayz Code",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnUrl?: string }>;
}) {
  const userId = await getUserIdOrNull();
  const { returnUrl: rawReturnUrl = "/dashboard" } = await searchParams;

  // Validate returnUrl to prevent open redirect vulnerabilities
  const returnUrl = validateReturnUrl(rawReturnUrl, publicAppUrl());

  if (userId) {
    redirect(returnUrl);
  }

  return <Login returnUrl={returnUrl} />;
}
