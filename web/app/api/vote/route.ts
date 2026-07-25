import { NextRequest, NextResponse } from "next/server";
import { demoMode, recordVote } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEMO_VOTER_COOKIE = "sus_demo_voter";

export async function POST(request: NextRequest) {
  let body: { winnerId?: string; loserId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { winnerId, loserId } = body;
  if (!winnerId || !loserId || winnerId === loserId) {
    return NextResponse.json({ error: "invalid_matchup" }, { status: 400 });
  }

  try {
    if (demoMode()) {
      const voterKey = request.cookies.get(DEMO_VOTER_COOKIE)?.value;
      if (!voterKey) {
        return NextResponse.json({ error: "no_session" }, { status: 400 });
      }
      const result = await recordVote(null, voterKey, winnerId, loserId);
      return NextResponse.json(result);
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "login_required" }, { status: 401 });
    }
    const result = await recordVote(supabase, user.id, winnerId, loserId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    const status = message.includes("already_voted") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
