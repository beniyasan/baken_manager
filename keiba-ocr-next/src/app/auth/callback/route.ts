import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    const redirectUrl = new URL("/login", requestUrl.origin);
    redirectUrl.searchParams.set("error", "missing_oauth_code");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.exchangeCodeForSession(code);

  const next = requestUrl.searchParams.get("next");
  const redirectPath = next && next.startsWith("/") ? next : "/dashboard";
  const redirectUrl = new URL(redirectPath, requestUrl.origin);

  return NextResponse.redirect(redirectUrl);
}
