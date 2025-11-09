import { prisma } from "@/lib/db";
import type { HoldingPayload } from "@/lib/connectors/types";
import { ensureDatabaseConsistency } from "@/lib/server/ensureDatabaseConsistency";

export const DEFAULT_CURRENCY = "JPY";

export const persistAccountData = async (
  accountId: string,
  holdings: HoldingPayload[],
  logMessages?: string[]
) => {
  await ensureDatabaseConsistency();
  const capturedAt = new Date();

  await prisma.$transaction([
    prisma.holding.deleteMany({ where: { accountId } }),
    prisma.holding.createMany({
      data: holdings.map((holding) => ({
        accountId,
        symbol: holding.symbol,
        name: holding.name,
        quantity: holding.quantity,
        avgPrice: holding.avgPrice ?? null,
        costAmount: holding.costAmount ?? null,
        marketValue: holding.marketValue,
        currency: holding.currency,
        profitAmount: holding.profitAmount ?? null,
        profitRate: holding.profitRate ?? null,
        group: holding.group ?? null
      }))
    }),
    prisma.account.updateMany({
      where: { id: accountId },
      data: { lastSyncedAt: capturedAt }
    })
  ]);

  const totalValue = holdings.reduce(
    (sum, holding) => sum + (holding.marketValue ?? 0),
    0
  );

  await prisma.accountSnapshot.create({
    data: {
      accountId,
      capturedAt,
      totalValue,
      holdingsRaw: holdings,
      holdingSnapshots: {
        create: holdings.map((holding) => ({
          accountId,
          symbol: holding.symbol,
          name: holding.name,
          quantity: holding.quantity,
          avgPrice: holding.avgPrice ?? null,
          costAmount: holding.costAmount ?? null,
          marketValue: holding.marketValue ?? 0,
          currency: holding.currency,
          profitAmount: holding.profitAmount ?? null,
          profitRate: holding.profitRate ?? null,
          group: holding.group ?? null,
          capturedAt
        }))
      }
    }
  });

  if (logMessages && logMessages.length > 0) {
    await prisma.syncLog.createMany({
      data: logMessages.map((message) => ({
        accountId,
        level: "info",
        message
      }))
    });
  }
};
