import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

export const runtime = "nodejs";

const DEFAULT_REDIRECT_PATH = "/dashboard";

const buildRedirectUrl = (requestUrl: URL, path: string): URL =>
  new URL(path, requestUrl.origin);

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    const redirectUrl = buildRedirectUrl(requestUrl, "/login");
    redirectUrl.searchParams.set("error", "missing_oauth_code");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Failed to exchange OAuth code for session", exchangeError);
    const redirectUrl = buildRedirectUrl(requestUrl, "/login");
    redirectUrl.searchParams.set("error", "oauth_exchange_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const next = requestUrl.searchParams.get("next");
  const redirectPath = next && next.startsWith("/") ? next : DEFAULT_REDIRECT_PATH;
  const redirectUrl = buildRedirectUrl(requestUrl, redirectPath);

  return NextResponse.redirect(redirectUrl);
}
