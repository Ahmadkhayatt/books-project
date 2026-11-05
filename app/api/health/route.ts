import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const version = process.env.npm_package_version ?? "0.1.0";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", version });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
