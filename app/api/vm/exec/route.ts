import { NextResponse } from "next/server";
import { callOpenRouter, MissingApiKeyError, OpenRouterRequestError } from "@/lib/openrouter";
import { buildVmExecMessages, VM_RESOLVED_MARKER, type VmExchange, type VmSpec } from "@/lib/vm";
import type { ScenarioSeed } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const seed = body?.seed as ScenarioSeed | undefined;
  const spec = body?.spec as VmSpec | undefined;
  const history = body?.history as VmExchange[] | undefined;
  const command = body?.command;

  if (!seed || typeof seed !== "object" || !spec || typeof spec !== "object") {
    return NextResponse.json({ error: "Missing seed or spec" }, { status: 400 });
  }
  if (!Array.isArray(history) || typeof command !== "string" || command.trim() === "") {
    return NextResponse.json({ error: "history[] and command required" }, { status: 400 });
  }

  try {
    const raw = await callOpenRouter(buildVmExecMessages(seed, spec, history, command.trim()));
    const resolved = raw.includes(VM_RESOLVED_MARKER);
    const output = raw.replaceAll(VM_RESOLVED_MARKER, "").trimEnd();
    return NextResponse.json({ output, resolved }, { status: 200 });
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof OpenRouterRequestError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    throw err;
  }
}
