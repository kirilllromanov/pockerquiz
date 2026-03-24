import { NextResponse } from "next/server";

import { sanitizeState } from "@/lib/game-engine";
import { readState } from "@/lib/game-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") === "host" ? "host" : "player";
  const state = await readState();

  return NextResponse.json({
    ok: true,
    data: sanitizeState(state, role),
  });
}
