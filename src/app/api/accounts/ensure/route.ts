import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PROVIDER_CONFIG, type ProviderKey } from "@/config/providers";

const requestSchema = z.object({
  provider: z.string().min(1)
});

const DEFAULT_METHOD = "manual-scrape";
const DEFAULT_CURRENCY = "JPY";

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parseResult = requestSchema.safeParse(json);

  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const providerKey = parseResult.data.provider as ProviderKey;
  const providerConfig = PROVIDER_CONFIG[providerKey];

  if (!providerConfig) {
    return NextResponse.json({ error: "provider not supported" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.account.findFirst({
      where: {
        provider: providerKey,
        method: DEFAULT_METHOD
      }
    });

    if (existing) {
      return { account: existing, created: false };
    }

    const account = await tx.account.create({
      data: {
        name: providerConfig.label,
        provider: providerKey,
        method: DEFAULT_METHOD,
        credentialRef: null,
        currency: DEFAULT_CURRENCY
      }
    });

    return { account, created: true };
  });

  return NextResponse.json(result.account, { status: result.created ? 201 : 200 });
}
