import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDatabaseConsistency } from "@/lib/server/ensureDatabaseConsistency";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().min(1),
  provider: z.string().min(1),
  method: z.string().min(1),
  credentialRef: z.string().nullable().optional(),
  currency: z.string().min(1)
});

export async function GET() {
  await ensureDatabaseConsistency();
  const accounts = await prisma.account.findMany({
    include: { holdings: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parseResult = bodySchema.safeParse(json);

  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const account = await prisma.account.create({ data: parseResult.data });
  return NextResponse.json(account, { status: 201 });
}
