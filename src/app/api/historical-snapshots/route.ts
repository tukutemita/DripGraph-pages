import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PROVIDER_CONFIG, type ProviderKey, type ProviderKind } from "@/config/providers";

const ASSET_KIND_OPTIONS = ["investment", "cash"] as const;
type AssetKind = (typeof ASSET_KIND_OPTIONS)[number];

const requestSchema = z.object({
  accountId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  capturedAt: z.string().datetime().optional(),
  assetKind: z.enum(ASSET_KIND_OPTIONS).optional()
});

const parseAmount = (input: string | number) => {
  if (typeof input === "number") {
    return input;
  }
  const normalized = input.replace(/[^\d.-]/g, "");
  if (normalized.length === 0) {
    return Number.NaN;
  }
  return Number(normalized);
};

const getCapturedDate = (period: string | undefined, capturedAt: string | undefined) => {
  if (capturedAt) {
    const date = new Date(capturedAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error("invalid capturedAt value");
    }
    return date;
  }

  if (!period) {
    throw new Error("period is required when capturedAt is not provided");
  }

  const [yearStr, monthStr] = period.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) {
    throw new Error("invalid period value");
  }
  return new Date(Date.UTC(year, month, 1));
};

const resolveProviderKind = (provider: ProviderKey | string, method: string | null | undefined): ProviderKind => {
  const config = PROVIDER_CONFIG[provider as ProviderKey];
  if (config) {
    return config.kind;
  }
  if (method && (method === "manual-snapshot" || method === "manual-scrape")) {
    return "bank";
  }
  return "securities";
};

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parseResult = requestSchema.safeParse(json);

  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const amount = parseAmount(parseResult.data.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  let targetDate: Date;
  try {
    targetDate = getCapturedDate(parseResult.data.period, parseResult.data.capturedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id: parseResult.data.accountId } });
  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  const providerKey = account.provider as ProviderKey;
  const providerKind = resolveProviderKind(providerKey, account.method);
  const assetKind: AssetKind =
    parseResult.data.assetKind ?? (providerKind === "bank" ? "cash" : "investment");
  const group = assetKind === "cash" ? "\u73fe\u91d1\u8cc7\u7523" : "\u904b\u7528\u8cc7\u7523";
  const holdingsRaw = [
    {
      name: `${account.name} 手入力スナップショット`,
      group,
      marketValue: amount,
      currency: account.currency ?? "JPY"
    }
  ];

  const symbolPrefix = assetKind === "cash" ? "MANUAL-CASH-HIST" : "MANUAL-INV-HIST";

  const upsertResult = await prisma.$transaction(async (tx) => {
    const existing = await tx.accountSnapshot.findFirst({
      where: {
        accountId: account.id,
        capturedAt: targetDate
      }
    });

    if (existing) {
      await tx.holdingSnapshot.deleteMany({ where: { snapshotId: existing.id } });
      const updated = await tx.accountSnapshot.update({
        where: { id: existing.id },
        data: { totalValue: amount, holdingsRaw }
      });
      await tx.holdingSnapshot.create({
        data: {
          snapshotId: updated.id,
          accountId: account.id,
          symbol: `${symbolPrefix}-${updated.id}`,
          name: `${account.name} 手入力スナップショット`,
          quantity: 1,
          avgPrice: amount,
          costAmount: amount,
          marketValue: amount,
          currency: account.currency ?? "JPY",
          profitAmount: null,
          group,
          capturedAt: targetDate
        }
      });
      return updated;
    }

    const created = await tx.accountSnapshot.create({
      data: {
        accountId: account.id,
        capturedAt: targetDate,
        totalValue: amount,
        holdingsRaw
      }
    });

    await tx.holdingSnapshot.create({
      data: {
        snapshotId: created.id,
        accountId: account.id,
        symbol: `${symbolPrefix}-${created.id}`,
        name: `${account.name} 手入力スナップショット`,
        quantity: 1,
        avgPrice: amount,
        costAmount: amount,
        marketValue: amount,
        currency: account.currency ?? "JPY",
        profitAmount: null,
        group,
        capturedAt: targetDate
      }
    });

    return created;
  });

  await prisma.syncLog.create({
    data: {
      accountId: account.id,
      level: "info",
      message: `manual historical snapshot recorded for ${targetDate.toISOString()}: ${amount.toLocaleString("ja-JP")} JPY`
    }
  });

  return NextResponse.json({
    ok: true,
    snapshot: {
      id: upsertResult.id,
      capturedAt: upsertResult.capturedAt.toISOString(),
      totalValue: upsertResult.totalValue
    }
  });
}
