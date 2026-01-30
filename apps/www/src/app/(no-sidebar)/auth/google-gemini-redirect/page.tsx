import type { GeminiAuthType } from "@/lib/google-oauth";
import { GoogleRedirect } from "@/components/credentials/google-redirect";

export default async function GoogleGeminiRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: GeminiAuthType;
    code?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;

  // If this is the callback with code and state, render the callback handler
  if (params.code && params.state) {
    return <GoogleOAuthCallback code={params.code} state={params.state} />;
  }

  // Otherwise, this is the initial redirect to start OAuth flow
  const type = params.type || "subscription";
  return <GoogleRedirect type={type} />;
}

// Client component to handle the OAuth callback
function GoogleOAuthCallback({ code, state }: { code: string; state: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold mb-4">
          Authentication Successful
        </h1>
        <p className="text-muted-foreground mb-4">
          Copy the code below and paste it in the credential dialog:
        </p>
        <div className="bg-muted p-3 rounded-md font-mono text-sm break-all select-all">
          {code}#{state}
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          You can close this window after copying the code.
        </p>
      </div>
    </div>
  );
}
