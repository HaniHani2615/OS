import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in dev mode" }, { status: 403 });
  }

  const patch = await req.json();
  if (!Array.isArray(patch)) {
    return NextResponse.json({ error: "Expected array" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "public", "data", "overrides.json");
  await fs.writeFile(filePath, JSON.stringify(patch, null, 2) + "\n", "utf-8");

  return NextResponse.json({ ok: true, count: patch.length });
}
