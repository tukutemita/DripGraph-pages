import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PROVIDER_CONFIG, type ProviderKey } from "@/config/providers";
import type { HoldingPayload } from "@/lib/connectors/types";
import { DEFAULT_CURRENCY, persistAccountData } from "@/lib/server/persistAccountData";

const MANUAL_SNAPSHOT_METHOD = "manual-snapshot";
const MANUAL_SCRAPE_METHOD = "manual-scrape";
const MANUAL_BANK_PROVIDER: ProviderKey = "manual-bank";
const MANUAL_SECURITIES_PROVIDER: ProviderKey = "manual-securities";
const MANUAL_SUPPORTED_KINDS = ["bank", "securities"] as const;
type ManualKind = (typeof MANUAL_SUPPORTED_KINDS)[number];

const requestSchema = z.object({
  accountId: z.string().min(1).optional(),
  name: z.string().min(1),
  kind: z.enum(MANUAL_SUPPORTED_KINDS).default("bank"),
  profitAmount: z.number().optional(),
  profitRate: z.number().optional()
});

const parseAmount = (input: unknown) => {
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "string") {
    const sanitized = input.replace(/[^\d.-]/g, "");
    if (sanitized.length === 0) {
      return Number.NaN;
    }
    return Number(sanitized);
  }
  return Number.NaN;
};

const resolveProviderKind = (providerKey: string, method: string | null | undefined) => {
  const provider = PROVIDER_CONFIG[providerKey as ProviderKey];
  if (provider) {
    return provider.kind;
  }
  if (method === MANUAL_SNAPSHOT_METHOD || method === MANUAL_SCRAPE_METHOD) {
    return "bank";
  }
  return "securities";
};

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parseResult = requestSchema.safeParse({
    accountId: json.accountId,
    name: json.name,
    kind: json.kind,
    profitAmount: json.profitAmount,
    profitRate: json.profitRate
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const amount = parseAmount(json.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "invalid amount" }, { status: 400 });
  }

  const name = parseResult.data.name.trim();
  if (name.length === 0) {
    return NextResponse.json({ error: "invalid account name" }, { status: 400 });
  }

  const manualKind: ManualKind = parseResult.data.kind;
  const manualProvider =
    manualKind === "bank" ? MANUAL_BANK_PROVIDER : MANUAL_SECURITIES_PROVIDER;
  const profitAmountInput = parseResult.data.profitAmount ?? null;
  const profitRateInput = parseResult.data.profitRate ?? null;

  let account =
    parseResult.data.accountId != null
      ? await prisma.account.findUnique({ where: { id: parseResult.data.accountId } })
      : await prisma.account.findFirst({
          where: {
            name,
            provider: manualProvider,
            method: { in: [MANUAL_SNAPSHOT_METHOD, MANUAL_SCRAPE_METHOD] }
          }
        });

  let created = false;

  if (!account) {
    account = await prisma.account.create({
      data: {
        name,
        provider: manualProvider,
        method: MANUAL_SNAPSHOT_METHOD,
        credentialRef: null,
        currency: DEFAULT_CURRENCY
      }
    });
    created = true;
  } else if (account.method !== MANUAL_SNAPSHOT_METHOD) {
    account = await prisma.account.update({
      where: { id: account.id },
      data: { method: MANUAL_SNAPSHOT_METHOD }
    });
  }

  if (!account) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }

  const providerKind = resolveProviderKind(account.provider, account.method);
  if (providerKind !== manualKind) {
    return NextResponse.json({ error: "manual snapshots are not supported for this account" }, { status: 400 });
  }

  if (account.provider !== manualProvider) {
    account = await prisma.account.update({
      where: { id: account.id },
      data: { provider: manualProvider }
    });
  }

  const nameSuffix = manualKind === "bank" ? "\u73fe\u91d1\u8cc7\u7523" : "\u904b\u7528\u8cc7\u7523";
  const group = manualKind === "bank" ? "\u73fe\u91d1\u8cc7\u7523" : "\u904b\u7528\u8cc7\u7523";
  const symbolPrefix = manualKind === "bank" ? "MANUAL-BANK" : "MANUAL-SECURITIES";

  let costAmount = amount;
  let profitAmount: number | null = null;
  let profitRate: number | null = null;

  if (manualKind === "securities") {
    if (profitAmountInput != null) {
      const candidateCost = amount - profitAmountInput;
      if (candidateCost < 0) {
        return NextResponse.json({ error: "invalid profit amount" }, { status: 400 });
      }
      costAmount = candidateCost;
      profitAmount = profitAmountInput;
      if (candidateCost > 0) {
        profitRate = (profitAmountInput / candidateCost) * 100;
      }
    } else if (profitRateInput != null) {
      const denominator = 1 + profitRateInput / 100;
      if (denominator <= 0) {
        return NextResponse.json({ error: "invalid profit rate" }, { status: 400 });
      }
      costAmount = amount / denominator;
      profitAmount = amount - costAmount;
      profitRate = profitRateInput;
    }

    // Normalize numbers to avoid lingering floating point artifacts
    costAmount = Math.round(costAmount * 100) / 100;
    if (profitAmount != null) {
      profitAmount = Math.round(profitAmount * 100) / 100;
    }
    if (profitRate != null) {
      profitRate = Math.round(profitRate * 100) / 100;
    }
  }

  const logDetails: string[] = [];
  if (profitAmount != null) {
    logDetails.push(
      `profit=${profitAmount.toLocaleString("ja-JP")} JPY`
    );
  }
  if (profitRate != null) {
    logDetails.push(`rate=${profitRate.toFixed(2)}%`);
  }

  const holdings: HoldingPayload[] = [
    {
      symbol: `${symbolPrefix}-${account.id}`,
      name: `${name} ${nameSuffix}`,
      quantity: 1,
      costAmount,
      marketValue: amount,
      currency: "JPY",
      profitAmount: profitAmount ?? undefined,
      profitRate: profitRate ?? undefined,
      group
    }
  ];

  const logSummary =
    logDetails.length > 0
      ? `manual snapshot recorded (${amount.toLocaleString("ja-JP")} JPY, ${logDetails.join(", ")})`
      : `manual snapshot recorded (${amount.toLocaleString("ja-JP")} JPY)`;

  await persistAccountData(account.id, holdings, [logSummary]);

  const updatedAccount = await prisma.account.findUnique({ where: { id: account.id } });

  return NextResponse.json({
    ok: true,
    account: {
      id: account.id,
      name: account.name,
      provider: account.provider as ProviderKey,
      method: updatedAccount?.method ?? account.method,
      lastSyncedAt: updatedAccount?.lastSyncedAt ? updatedAccount.lastSyncedAt.toISOString() : null
    },
    created
  });
}
