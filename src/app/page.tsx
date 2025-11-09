import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { DashboardView } from "@/ui/dashboard";
import { PROVIDER_CONFIG, type ProviderKey, type ProviderKind } from "@/config/providers";
import { ensureDatabaseConsistency } from "@/lib/server/ensureDatabaseConsistency";

const COLORS = ["#2A72E5", "#8B5CF6", "#FACC15", "#26C485", "#E54D4D", "#F97316"];

const SNAPSHOT_PORTFOLIO_CATEGORIES = [
  { key: "stock", label: "株式", color: "#2A72E5", keywords: ["株式"] },
  { key: "fund", label: "投資信託", color: "#8B5CF6", keywords: ["投資信託"] },
  { key: "bond", label: "債券", color: "#FACC15", keywords: ["債券"] },
  {
    key: "pension",
    label: "年金",
    color: "#0EA5E9",
    keywords: ["確定拠出", "年金", "ideco", "iDeCo", "dc", "definedcontribution"]
  },
  { key: "cash", label: "現金", color: "#26C485", keywords: ["現金", "預金", "キャッシュ"] },
  { key: "other", label: "その他", color: "#E54D4D", keywords: [] }
] as const;

type SnapshotCategoryKey = (typeof SNAPSHOT_PORTFOLIO_CATEGORIES)[number]["key"];

type SnapshotHolding = {
  name?: unknown;
  group?: unknown;
  category?: unknown;
  label?: unknown;
  type?: unknown;
  marketValue?: unknown;
  amount?: unknown;
  value?: unknown;
  balance?: unknown;
  currency?: unknown;
  profitAmount?: unknown;
  costAmount?: unknown;
};

type RateMap = Map<string, number>;

type AccountWithHoldings = Prisma.AccountGetPayload<{ include: { holdings: true } }>;

type HoldingWithComputed = {
  id: string;
  name: string;
  symbol: string;
  accountId: string;
  accountProvider: ProviderKey;
  accountKind: ProviderKind;
  accountLabel: string;
  group: string;
  marketValueJPY: number;
  costAmountJPY: number;
  profitAmountJPY: number;
  lastSyncedAt: Date;
};

type AccountSnapshotRecord = Awaited<ReturnType<typeof prisma.accountSnapshot.findMany>>[number];
type HoldingRowItem = {
  name: string;
  evaluation: number;
  profitLoss: number;
};

const trendLabelFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Tokyo"
});

const buildRateMap = async (): Promise<RateMap> => {
  const snapshots = await prisma.rateSnapshot.findMany({
    orderBy: { takenAt: "desc" }
  });

  const map: RateMap = new Map();
  for (const snapshot of snapshots) {
    const key = `${snapshot.base}-${snapshot.quote}`;
    if (!map.has(key)) {
      map.set(key, snapshot.rate);
    }
  }
  return map;
};

const convertCurrency = (amount: number | null | undefined, from: string, to: string, rateMap: RateMap) => {
  if (amount == null || Number.isNaN(amount)) return 0;
  if (from === to) return amount;

  const directKey = `${from}-${to}`;
  const directRate = rateMap.get(directKey);
  if (directRate) {
    return amount * directRate;
  }

  const inverseKey = `${to}-${from}`;
  const inverseRate = rateMap.get(inverseKey);
  if (inverseRate) {
    return amount / inverseRate;
  }

  return amount;
};

const toText = (value: unknown) => (typeof value === "string" ? value : value != null ? String(value) : "");

const normalizeForCategory = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();

const detectCategoryByTextSegments = (...segments: unknown[]): SnapshotCategoryKey => {
  const combined = segments.map(toText).map(normalizeForCategory).join("");

  for (const category of SNAPSHOT_PORTFOLIO_CATEGORIES) {
    if (category.key === "other") {
      continue;
    }
    if (category.keywords.some((keyword) => combined.includes(normalizeForCategory(keyword)))) {
      return category.key;
    }
  }

  return "other";
};

const parseSnapshotHoldings = (raw: Prisma.JsonValue): SnapshotHolding[] => {
  if (Array.isArray(raw)) {
    return raw as SnapshotHolding[];
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as SnapshotHolding[];
      }
    } catch {
      // ignore parse errors
    }
  }
  return [];
};

const readNumeric = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.replace(/,/g, ""));
    if (!Number.isNaN(numeric)) {
      return numeric;
    }
  }
  return null;
};

const detectSnapshotCategory = (holding: SnapshotHolding): SnapshotCategoryKey =>
  detectCategoryByTextSegments(holding.name, holding.group, holding.category, holding.type, holding.label);

const computePortfolioFromSnapshots = (
  snapshots: AccountSnapshotRecord[],
  rateMap: RateMap
) => {
  if (snapshots.length === 0) {
    return [];
  }

  const valueTotals = new Map<SnapshotCategoryKey, number>();
  const pensionProfits = new Map<SnapshotCategoryKey, number>();

  snapshots.forEach((snapshot) => {
    const holdings = parseSnapshotHoldings(snapshot.holdingsRaw);
    holdings.forEach((rawHolding) => {
      const numericCandidate =
        readNumeric(rawHolding.marketValue) ??
        readNumeric(rawHolding.amount) ??
        readNumeric(rawHolding.value) ??
        readNumeric(rawHolding.balance);

      if (numericCandidate == null || numericCandidate === 0) {
        return;
      }

      const currencyCandidate = toText(rawHolding.currency) || "JPY";
      const valueJPY = convertCurrency(numericCandidate, currencyCandidate, "JPY", rateMap);
      if (valueJPY === 0) {
        return;
      }

      const categoryKey = detectSnapshotCategory(rawHolding);
      valueTotals.set(categoryKey, (valueTotals.get(categoryKey) ?? 0) + valueJPY);

      if (categoryKey === "pension") {
        const rawProfit = readNumeric(rawHolding.profitAmount);
        let profitJPY: number | null = null;
        if (rawProfit != null) {
          profitJPY = convertCurrency(rawProfit, currencyCandidate, "JPY", rateMap);
        } else {
          const rawCost = readNumeric(rawHolding.costAmount);
          if (rawCost != null) {
            const costJPY = convertCurrency(rawCost, currencyCandidate, "JPY", rateMap);
            profitJPY = valueJPY - costJPY;
          }
        }
        if (profitJPY != null && Number.isFinite(profitJPY)) {
          pensionProfits.set(
            categoryKey,
            (pensionProfits.get(categoryKey) ?? 0) + profitJPY
          );
        }
      }
    });
  });

  const results = SNAPSHOT_PORTFOLIO_CATEGORIES.map((category) => ({
    name: category.label,
    value: valueTotals.get(category.key) ?? 0,
    profit: category.key === "pension" ? pensionProfits.get(category.key) ?? 0 : 0,
    color: category.color
  }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  return results;
};

const computeHoldings = (
  accounts: AccountWithHoldings[],
  rateMap: RateMap
): HoldingWithComputed[] => {
  return accounts.flatMap((account) => {
    const providerKey = account.provider as ProviderKey;
    const provider = PROVIDER_CONFIG[providerKey];
    const accountLabel = account.name || provider?.label || account.provider;
    const accountKind =
      provider?.kind ??
      (account.method === "manual-snapshot" || account.method === "manual-scrape" ? "bank" : "securities");

    return account.holdings.map((holding) => {
      const marketValueJPY = convertCurrency(holding.marketValue, holding.currency, "JPY", rateMap);
      const costBasis =
        holding.costAmount ?? (holding.avgPrice != null ? holding.avgPrice * holding.quantity : null);
      const costAmountJPY = convertCurrency(costBasis, holding.currency, "JPY", rateMap);
      const profitAmountSource =
        holding.profitAmount != null ? holding.profitAmount : costBasis != null ? holding.marketValue - costBasis : 0;
      const profitAmountJPY = convertCurrency(profitAmountSource, holding.currency, "JPY", rateMap);

      return {
        id: holding.id,
        name: holding.name,
        symbol: holding.symbol,
        accountId: account.id,
        accountProvider: providerKey,
        accountKind,
        accountLabel,
        group: holding.group ?? accountLabel,
        marketValueJPY,
        costAmountJPY,
        profitAmountJPY,
        lastSyncedAt: holding.lastSyncedAt
      } satisfies HoldingWithComputed;
    });
  });
};

const computePortfolioFromHoldings = (holdings: HoldingWithComputed[]) => {
  if (holdings.length === 0) {
    return [];
  }

  const totals = new Map<SnapshotCategoryKey, number>();
  const pensionProfits = new Map<SnapshotCategoryKey, number>();

  holdings.forEach((holding) => {
    const initialCategory = detectCategoryByTextSegments(
      holding.name,
      holding.group,
      holding.symbol,
      holding.accountLabel
    );

    const categoryKey = holding.accountKind === "bank" ? "cash" : initialCategory;
    totals.set(categoryKey, (totals.get(categoryKey) ?? 0) + holding.marketValueJPY);

    if (categoryKey === "pension") {
      pensionProfits.set(
        categoryKey,
        (pensionProfits.get(categoryKey) ?? 0) + (holding.profitAmountJPY ?? 0)
      );
    }
  });

  return SNAPSHOT_PORTFOLIO_CATEGORIES.map((category) => ({
    name: category.label,
    value: totals.get(category.key) ?? 0,
    profit: category.key === "pension" ? pensionProfits.get(category.key) ?? 0 : 0,
    color: category.color
  }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
};

const aggregatePensionProfitFromHoldings = (holdings: HoldingWithComputed[]) => {
  if (holdings.length === 0) {
    return 0;
  }

  return holdings.reduce((sum, holding) => {
    const detectedCategory = detectCategoryByTextSegments(
      holding.name,
      holding.group,
      holding.symbol,
      holding.accountLabel
    );
    const categoryKey = holding.accountKind === "bank" ? "cash" : detectedCategory;
    if (categoryKey !== "pension") {
      return sum;
    }
    return sum + (holding.profitAmountJPY ?? 0);
  }, 0);
};

const dedupeSnapshotsByAccountDay = (snapshots: AccountSnapshotRecord[]) => {
  const latestByAccountDay = new Map<string, AccountSnapshotRecord>();

  snapshots.forEach((snapshot) => {
    const dayKey = snapshot.capturedAt.toISOString().slice(0, 10);
    const key = `${snapshot.accountId}-${dayKey}`;
    const existing = latestByAccountDay.get(key);
    if (!existing || existing.capturedAt < snapshot.capturedAt) {
      latestByAccountDay.set(key, snapshot);
    }
  });

  return Array.from(latestByAccountDay.values());
};

const computeTrend = (
  snapshots: Awaited<ReturnType<typeof prisma.accountSnapshot.findMany>>,
  accounts: AccountWithHoldings[],
  holdings: HoldingWithComputed[]
) => {
  type TrendAccumulator = { total: number; investment: number; cash: number };

  const normalizeGroup = (value: unknown) =>
    typeof value === "string" ? value.replace(/[\s\u3000]+/g, " ").trim() : "";

  const parseSnapshotHoldings = (raw: unknown) => {
    const toArray = (value: unknown): unknown[] | null => {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : null;
        } catch {
          return null;
        }
      }
      return null;
    };
    return toArray(raw)?.filter((item): item is Record<string, unknown> => item != null && typeof item === "object") ?? null;
  };

  const calculateSnapshotTotals = (
    snapshot: Awaited<ReturnType<typeof prisma.accountSnapshot.findMany>>[number],
    kind: ProviderKind
  ): TrendAccumulator => {
    const holdingsRaw = parseSnapshotHoldings(snapshot.holdingsRaw);
    if (holdingsRaw && holdingsRaw.length > 0) {
      const totals: TrendAccumulator = { total: 0, investment: 0, cash: 0 };
      holdingsRaw.forEach((holding) => {
        const marketValue = holding.marketValue;
        const value =
          typeof marketValue === "number"
            ? marketValue
            : typeof marketValue === "string"
            ? Number.parseFloat(marketValue.replace(/[^\d.-]/g, ""))
            : NaN;
        if (!Number.isFinite(value)) {
          return;
        }

        const group = normalizeGroup(holding.group);
        if (group === "\u73fe\u91d1\u8cc7\u7523") {
          totals.cash += value;
        } else if (group === "\u904b\u7528\u8cc7\u7523") {
          totals.investment += value;
        } else if (kind === "bank") {
          totals.cash += value;
        } else {
          totals.investment += value;
        }
        totals.total += value;
      });

      if (totals.total > 0 || holdingsRaw.length > 0) {
        return totals;
      }
    }

    const fallback = snapshot.totalValue ?? 0;
    return kind === "bank"
      ? { total: fallback, investment: 0, cash: fallback }
      : { total: fallback, investment: fallback, cash: 0 };
  };

  const accountKindById = new Map<string, ProviderKind>();
  accounts.forEach((account) => {
    const providerKey = account.provider as ProviderKey;
    const provider = providerKey ? PROVIDER_CONFIG[providerKey] : undefined;
    const kind =
      provider?.kind ??
      (account.method === "manual-snapshot" || account.method === "manual-scrape" ? "bank" : "securities");
    accountKindById.set(account.id, kind);
  });

  const snapshotsPerDay = snapshots.length > 0 ? dedupeSnapshotsByAccountDay(snapshots) : snapshots;

  if (snapshotsPerDay.length > 0) {
    const sorted = [...snapshotsPerDay].sort(
      (a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()
    );

    const latestByAccount = new Map<string, TrendAccumulator>();
    const trendPoints: Array<{
      date: string;
      label: string;
      total: number;
      investment: number;
      cash: number;
      hasSnapshot: boolean;
    }> = [];

    let currentTimestamp: number | null = null;
    let buffer: typeof sorted = [];
    let lastAggregated: TrendAccumulator | null = null;
    let lastTimestamp: number | null = null;

    const flush = (timestamp: number) => {
      if (buffer.length === 0) {
        return;
      }

      buffer.forEach((snapshot) => {
        const kind = accountKindById.get(snapshot.accountId) ?? "securities";
        const accountTotals = calculateSnapshotTotals(snapshot, kind);
        latestByAccount.set(snapshot.accountId, accountTotals);
      });
      buffer = [];

      const aggregated: TrendAccumulator = { total: 0, investment: 0, cash: 0 };
      latestByAccount.forEach((entry) => {
        aggregated.total += entry.total;
        aggregated.investment += entry.investment;
        aggregated.cash += entry.cash;
      });

      lastAggregated = { ...aggregated };
      lastTimestamp = timestamp;

      const date = new Date(timestamp);
      trendPoints.push({
        date: date.toISOString(),
        label: trendLabelFormatter.format(date),
        total: Math.round(aggregated.total),
        investment: Math.round(aggregated.investment),
        cash: Math.round(aggregated.cash),
        hasSnapshot: true
      });
    };

    sorted.forEach((snapshot) => {
      const capturedAt = snapshot.capturedAt;
      const time = capturedAt.getTime();
      if (currentTimestamp === null) {
        currentTimestamp = time;
      }
      if (time !== currentTimestamp) {
        flush(currentTimestamp);
        currentTimestamp = time;
      }
      buffer.push(snapshot);
    });

    if (currentTimestamp !== null) {
      flush(currentTimestamp);
    }

    if (lastAggregated !== null && lastTimestamp !== null) {
      const totalsAtLastPoint: TrendAccumulator = lastAggregated;
      const today = new Date();
      if (today.getTime() > lastTimestamp) {
        trendPoints.push({
          date: today.toISOString(),
          label: trendLabelFormatter.format(today),
          total: Math.round(totalsAtLastPoint.total),
          investment: Math.round(totalsAtLastPoint.investment),
          cash: Math.round(totalsAtLastPoint.cash),
          hasSnapshot: false
        });
      }
    }

    return trendPoints;
  }

  const totalsByAccount = new Map<string, TrendAccumulator>();
  holdings.forEach((holding) => {
    const current = totalsByAccount.get(holding.accountId) ?? { total: 0, investment: 0, cash: 0 };
    current.total += holding.marketValueJPY;
    if (holding.accountKind === "bank") {
      current.cash += holding.marketValueJPY;
    } else {
      current.investment += holding.marketValueJPY;
    }
    totalsByAccount.set(holding.accountId, current);
  });

  let latestSynced: Date | null = null;
  accounts.forEach((account) => {
    if (!account.lastSyncedAt) {
      return;
    }
    if (!latestSynced || account.lastSyncedAt.getTime() > latestSynced.getTime()) {
      latestSynced = account.lastSyncedAt;
    }
  });

  if (!latestSynced) {
    return [];
  }

  const syncedAt: Date = latestSynced;
  const today = new Date();

  const aggregated: TrendAccumulator = { total: 0, investment: 0, cash: 0 };
  totalsByAccount.forEach((entry) => {
    aggregated.total += entry.total;
    aggregated.investment += entry.investment;
    aggregated.cash += entry.cash;
  });

  const result = [
    {
      date: syncedAt.toISOString(),
      label: trendLabelFormatter.format(syncedAt),
      total: Math.round(aggregated.total),
      investment: Math.round(aggregated.investment),
      cash: Math.round(aggregated.cash),
      hasSnapshot: true
    }
  ];

  if (today.getTime() > syncedAt.getTime()) {
    result.push({
      date: today.toISOString(),
      label: trendLabelFormatter.format(today),
      total: Math.round(aggregated.total),
      investment: Math.round(aggregated.investment),
      cash: Math.round(aggregated.cash),
      hasSnapshot: false
    });
  }

  return result;
};

const computeAccountSummaries = (holdings: HoldingWithComputed[]) => {
  const summaries = new Map<
    string,
    {
      accountId: string;
      provider: ProviderKey;
      kind: ProviderKind;
      label: string;
      balance: number;
      lastSyncedAt: Date;
    }
  >();

  holdings.forEach((holding) => {
    const key = holding.accountId;
    const existing = summaries.get(key);
    const nextBalance = (existing?.balance ?? 0) + holding.marketValueJPY;
    if (existing) {
      summaries.set(key, { ...existing, balance: nextBalance, lastSyncedAt: holding.lastSyncedAt });
    } else {
      summaries.set(key, {
        accountId: holding.accountId,
        provider: holding.accountProvider,
        kind: holding.accountKind,
        label: holding.accountLabel,
        balance: holding.marketValueJPY,
        lastSyncedAt: holding.lastSyncedAt
      });
    }
  });

  return Array.from(summaries.values());
};

const computeAccountCards = (summaries: ReturnType<typeof computeAccountSummaries>) => {
  const totals = summaries.reduce(
    (acc, summary) => {
      if (summary.kind === "bank") {
        acc.bank += summary.balance;
      } else {
        acc.securities += summary.balance;
      }
      return acc;
    },
    { securities: 0, bank: 0 }
  );

  return [
    { name: "\u8a3c\u5238\u53e3\u5ea7", balance: totals.securities },
    { name: "\u9280\u884c\u53e3\u5ea7", balance: totals.bank }
  ];
};

const computeCashRows = (summaries: ReturnType<typeof computeAccountSummaries>) =>
  summaries
    .filter((summary) => summary.kind === "bank")
    .map((summary) => ({
      bank: summary.label,
      balance: summary.balance
    }))
    .sort((a, b) => b.balance - a.balance);

const computeHoldingRows = (holdings: HoldingWithComputed[]) => {
  const totals = new Map<
    SnapshotCategoryKey,
    {
      evaluation: number;
      profitLoss: number;
    }
  >();

  holdings.forEach((holding) => {
    const detectedCategory = detectCategoryByTextSegments(
      holding.name,
      holding.group,
      holding.symbol,
      holding.accountLabel
    );

    const categoryKey: SnapshotCategoryKey =
      holding.accountKind === "bank" ? "cash" : detectedCategory;

    const existing = totals.get(categoryKey) ?? { evaluation: 0, profitLoss: 0 };
    existing.evaluation += holding.marketValueJPY;
    existing.profitLoss += holding.profitAmountJPY;
    totals.set(categoryKey, existing);
  });

  const rows: HoldingRowItem[] = [];

  SNAPSHOT_PORTFOLIO_CATEGORIES.forEach((category) => {
    const summary = totals.get(category.key);
    if (!summary || summary.evaluation === 0) {
      return;
    }
    rows.push({
      name: category.label,
      evaluation: summary.evaluation,
      profitLoss: summary.profitLoss
    });
  });

  return rows.sort((a, b) => b.evaluation - a.evaluation);
};

export default async function Page() {
  await ensureDatabaseConsistency();
  const accounts = (await prisma.account.findMany({
    include: { holdings: true },
    orderBy: { createdAt: "asc" }
  })) as AccountWithHoldings[];

  const rateMap = await buildRateMap();

  let snapshots: Awaited<ReturnType<typeof prisma.accountSnapshot.findMany>> = [];
  try {
    snapshots = await prisma.accountSnapshot.findMany({
      orderBy: { capturedAt: "asc" }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")) {
      throw error;
    }
  }

  const latestSnapshotsByAccount = new Map<string, AccountSnapshotRecord>();
  snapshots.forEach((snapshot) => {
    const existing = latestSnapshotsByAccount.get(snapshot.accountId);
    if (!existing || existing.capturedAt < snapshot.capturedAt) {
      latestSnapshotsByAccount.set(snapshot.accountId, snapshot);
    }
  });

  const holdings = computeHoldings(accounts, rateMap);
  const pensionProfitFromHoldings = aggregatePensionProfitFromHoldings(holdings);

  const totalAssets = holdings.reduce((sum, holding) => sum + holding.marketValueJPY, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.costAmountJPY, 0);
  const totalProfit = totalAssets - totalCost;

  const snapshotPortfolio = computePortfolioFromSnapshots(
    Array.from(latestSnapshotsByAccount.values()),
    rateMap
  );
  const portfolioBase =
    snapshotPortfolio.length > 0 ? snapshotPortfolio : computePortfolioFromHoldings(holdings);
  const portfolio = portfolioBase.map((item) =>
    item.name === "年金" ? { ...item, profit: pensionProfitFromHoldings } : item
  );

  const trend = computeTrend(snapshots, accounts, holdings);
  const accountSummaries = computeAccountSummaries(holdings);
  const accountCards = computeAccountCards(accountSummaries);
  const cashRows = computeCashRows(accountSummaries);
  const holdingRows = computeHoldingRows(holdings);

  const latestSynced = accounts
    .map((account) => account.lastSyncedAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const connectableAccounts = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    provider: account.provider as ProviderKey,
    method: account.method,
    lastSyncedAt: account.lastSyncedAt ? account.lastSyncedAt.toISOString() : null
  }));

  return (
    <DashboardView
      metrics={{
        totalAssets,
        investmentAmount: totalCost,
        profitLoss: totalProfit
      }}
      lastSyncedAt={latestSynced ? latestSynced.toISOString() : null}
      portfolio={portfolio}
      trend={trend}
      accounts={accountCards}
      holdings={holdingRows}
      cash={cashRows}
      connectableAccounts={connectableAccounts}
    />
  );
}



















