import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  await supabase.auth.exchangeCodeForSession();
  const url = new URL("/dashboard", req.url);
  return NextResponse.redirect(url);
}
