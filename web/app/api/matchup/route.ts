import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { demoMode, getMatchup } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEMO_VOTER_COOKIE = "sus_demo_voter";

export async function GET(request: NextRequest) {
  try {
    if (demoMode()) {
      const voterKey =
        request.cookies.get(DEMO_VOTER_COOKIE)?.value ?? randomUUID();
      const matchup = await getMatchup(null, voterKey);
      const response = NextResponse.json({
        matchup: matchup ? { a: matchup[0], b: matchup[1] } : null,
        demo: true,
      });
      response.cookies.set(DEMO_VOTER_COOKIE, voterKey, {
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }
    const matchup = await getMatchup(supabase, user.id);
    return NextResponse.json({
      matchup: matchup ? { a: matchup[0], b: matchup[1] } : null,
      demo: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
