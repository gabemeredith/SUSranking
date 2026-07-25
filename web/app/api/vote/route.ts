import { NextRequest, NextResponse } from "next/server";
import { demoMode, recordVote } from "@/lib/data";
import { VoteRequestSchema } from "@/lib/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEMO_VOTER_COOKIE = "sus_demo_voter";

/** Domain errors (raised in Postgres / demo store) → HTTP status */
const ERROR_STATUS: Record<string, number> = {
  already_voted: 409,
  rate_limited: 429,
  invalid_matchup: 400,
  person_not_found: 404,
  not_authenticated: 401,
};

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = VoteRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { winnerId, loserId } = parsed.data;

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
    const known = Object.keys(ERROR_STATUS).find((k) => message.includes(k));
    return NextResponse.json(
      { error: known ?? message },
      { status: known ? ERROR_STATUS[known] : 500 }
    );
  }
}
