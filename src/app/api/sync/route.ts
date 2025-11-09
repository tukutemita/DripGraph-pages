import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registry } from "@/lib/connectors";
import { PROVIDER_CONFIG, type ProviderKey } from "@/config/providers";
import { DEFAULT_CURRENCY, persistAccountData } from "@/lib/server/persistAccountData";
import { z } from "zod";

const bodySchema = z.object({
  connector: z.string().min(1),
  accountId: z.string().min(1).optional(),
  params: z.record(z.any()).optional()
});

const MANUAL_SCRAPE_METHOD = "manual-scrape";
const MANUAL_SNAPSHOT_METHOD = "manual-snapshot";
const ensureManualScrapeAccount = async (provider: ProviderKey) => {
  const existing = await prisma.account.findFirst({
    where: { provider, method: { in: [MANUAL_SCRAPE_METHOD, MANUAL_SNAPSHOT_METHOD] } }
  });
  if (existing) {
    return existing;
  }

  const config = PROVIDER_CONFIG[provider];
  if (!config) {
    throw new Error(`unknown provider "${provider}" for linked snapshot creation`);
  }

  return prisma.account.create({
    data: {
      name: config.label,
      provider,
      method: MANUAL_SCRAPE_METHOD,
      credentialRef: null,
      currency: DEFAULT_CURRENCY
    }
  });
};

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parseResult = bodySchema.safeParse(json);

  if (!parseResult.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const { accountId, connector, params } = parseResult.data;

  const implementation = registry[connector as keyof typeof registry];
  if (!implementation) {
    return NextResponse.json({ error: "connector not found" }, { status: 404 });
  }

  try {
    const result = await implementation.sync(params ?? {});

    if (accountId) {
      await persistAccountData(accountId, result.holdings, result.logs);
    }

    if (result.linkedAccounts?.length) {
      for (const linked of result.linkedAccounts) {
        if (!linked.holdings.length) {
          continue;
        }
        const manualAccounts = await prisma.account.findMany({
          where: { provider: linked.provider, method: { in: [MANUAL_SCRAPE_METHOD, MANUAL_SNAPSHOT_METHOD] } }
        });

        const targetAccounts =
          manualAccounts.length > 0
            ? manualAccounts
            : [await ensureManualScrapeAccount(linked.provider)];

        if (manualAccounts.length === 0) {
          const message = `linked snapshot account auto-created for ${linked.provider}`;
          if (result.logs) {
            result.logs.push(message);
          } else {
            result.logs = [message];
          }
        }

        for (const targetAccount of targetAccounts) {
          await persistAccountData(targetAccount.id, linked.holdings, [
            `linked snapshot updated via ${connector} sync`
          ]);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      saved: result.holdings.length,
      logs: result.logs ?? []
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    if (accountId) {
      await prisma.syncLog.create({
        data: { accountId, level: "error", message: `sync failed: ${message}` }
      });
    }

    return NextResponse.json({ error: "sync failed", message }, { status: 500 });
  }
}
