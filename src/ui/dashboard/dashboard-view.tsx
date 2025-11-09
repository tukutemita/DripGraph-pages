"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { LayoutDashboard, PieChart as PieChartIcon, Settings, Plus, CalendarDays, X } from "lucide-react";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { cn, formatCurrencyJPY } from "@/lib/utils";
import type { ProviderKey } from "@/config/providers";
import type { SnapshotPurgeCounts } from "@/types/snapshots";
import { ConnectAccountDialog } from "./connect-account-dialog";
import { ManualHistoricalSnapshotDialog } from "./manual-historical-snapshot-dialog";
import type { ConnectableAccount } from "./types";

const TREND_LABEL_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Tokyo"
});

type PortfolioCategory = {
  name: string;
  value: number;
  profit?: number;
  color: string;
};

type TrendPoint = {
  date: string;
  label: string;
  total: number;
  investment: number;
  cash: number;
  hasSnapshot: boolean;
  isBeforeFirstSnapshot?: boolean;
};

type AccountSummary = {
  name: string;
  balance: number;
};

type HoldingRow = {
  name: string;
  evaluation: number;
  profitLoss: number;
};

type CashRow = {
  bank: string;
  balance: number;
};

type SnapshotPurgeFeedback = {
  type: "success" | "error";
  message: string;
};

type DashboardMetrics = {
  totalAssets: number;
  investmentAmount: number;
  profitLoss: number;
};

export type DashboardViewProps = {
  metrics: DashboardMetrics;
  lastSyncedAt: string | null;
  portfolio: PortfolioCategory[];
  trend: TrendPoint[];
  accounts: AccountSummary[];
  holdings: HoldingRow[];
  cash: CashRow[];
  connectableAccounts: ConnectableAccount[];
};

const TEXT = {
  navDashboard: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9",
  navPortfolio: "\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa",
  totalAssets: "\u7dcf\u8cc7\u7523",
  unitMan: "\u4e07\u5186",
  investmentAmount: "\u6295\u8cc7\u984d",
  cumulativePnl: "\u7d2f\u8a08\u8a55\u4fa1\u640d\u76ca",
  settings: "\u8a2d\u5b9a",
  settingsTitle: "\u8868\u793a\u8a2d\u5b9a",
  settingsDescription: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9\u306e\u80cc\u666f\u8272\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044",
  settingsThemeLabel: "\u80cc\u666f\u8272",
  settingsClose: "\u9589\u3058\u308b",
  deleteSnapshotsTitle: "\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u306e\u5168\u524a\u9664",
  deleteSnapshotsDescription: "\u3059\u3079\u3066\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u5c65\u6b74\uff08\u53e3\u5ea7\u30fb\u4fdd\u6709\u30fb\u30ec\u30fc\u30c8\uff09\u3092\u5b8c\u5168\u306b\u524a\u9664\u3057\u307e\u3059\u3002\u3053\u306e\u64cd\u4f5c\u306f\u53d6\u308a\u6d88\u305b\u307e\u305b\u3093\u3002",
  deleteSnapshotsButton: "\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3092\u5168\u524a\u9664",
  deleteSnapshotsConfirm: "\u672c\u5f53\u306b\u524a\u9664\u3057\u307e\u3059\u304b\uff1f",
  deleteSnapshotsWarning: "Yes \u3092\u62bc\u3059\u3068\u5168\u3066\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u304c\u524a\u9664\u3055\u308c\u307e\u3059\u3002\u5143\u306b\u623b\u3059\u3053\u3068\u306f\u3067\u304d\u307e\u305b\u3093\u3002",
  deleteSnapshotsYes: "Yes",
  deleteSnapshotsNo: "No",
  deleteSnapshotsInProgress: "\u524a\u9664\u4e2d\u2026",
  deleteSnapshotsSuccess: "\u5168\u3066\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3092\u524a\u9664\u3057\u307e\u3057\u305f",
  deleteSnapshotsError: "\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u306e\u524a\u9664\u306b\u5931\u6557\u3057\u307e\u3057\u305f",
  deleteSnapshotsAccountLabel: "\u53e3\u5ea7",
  deleteSnapshotsHoldingLabel: "\u4fdd\u6709\u660e\u7d30",
  deleteSnapshotsRateLabel: "\u30ec\u30fc\u30c8",
  deleteSnapshotsScopedTitle: "\u53e3\u5ea7\u3054\u3068\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u524a\u9664",
  deleteSnapshotsScopedDescription: "\u9078\u629e\u3057\u305f\u53e3\u5ea7\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u5c65\u6b74\u3068\u53e3\u5ea7\u81ea\u4f53\u3092\u524a\u9664\u3057\u307e\u3059\u3002",
  deleteSnapshotsScopedSelectLabel: "\u5bfe\u8c61\u53e3\u5ea7",
  deleteSnapshotsScopedPlaceholder: "\u53e3\u5ea7\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044",
  deleteSnapshotsScopedButton: "\u9078\u629e\u3057\u305f\u53e3\u5ea7\u3092\u5b8c\u5168\u524a\u9664",
  deleteSnapshotsScopedConfirm: "{account} \u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3068\u767b\u9332\u53e3\u5ea7\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f",
  deleteSnapshotsScopedWarning: "Yes \u3092\u62bc\u3059\u3068\u9078\u629e\u3057\u305f\u53e3\u5ea7\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3068\u30c7\u30fc\u30bf\u304c\u3059\u3079\u3066\u524a\u9664\u3055\u308c\u307e\u3059\u3002",
  deleteSnapshotsScopedNoAccount: "\u524a\u9664\u3067\u304d\u308b\u53e3\u5ea7\u304c\u3042\u308a\u307e\u305b\u3093",
  deleteSnapshotsScopedRequireAccount: "\u524a\u9664\u3059\u308b\u53e3\u5ea7\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044",
  deleteSnapshotsScopedSuccess: "\u9078\u629e\u3057\u305f\u53e3\u5ea7\u3092\u524a\u9664\u3057\u307e\u3057\u305f",
  themeWhite: "\u30db\u30ef\u30a4\u30c8",
  themeGray: "\u30b0\u30ec\u30fc",
  themeBlack: "\u30d6\u30e9\u30c3\u30af",
  dashboardTitle: "\u30c0\u30c3\u30b7\u30e5\u30dc\u30fc\u30c9",
  lastSynced: "\u6700\u7d42\u540c\u671f",
  connectButton: "\u53e3\u5ea7\u3092\u9023\u643a\u3059\u308b",
  historyButton: "\u904e\u53bb\u8cc7\u7523\u3092\u5165\u529b",
  securitiesAccount: "\u8a3c\u5238\u53e3\u5ea7",
  bankAccount: "\u9280\u884c\u53e3\u5ea7",
  portfolioTitle: "\u30dd\u30fc\u30c8\u30d5\u30a9\u30ea\u30aa",
  assetTrendTitle: "\u8cc7\u7523\u63a8\u79fb",
  trendAssetFilters: ["\u904b\u7528\u8cc7\u7523", "\u73fe\u91d1\u8cc7\u7523", "\u5168\u4f53"],
  trendFilters: ["1\u30f6\u6708", "3\u30f6\u6708", "1\u5e74", "\u5168\u671f\u9593"],
  accountSummary: "\u53e3\u5ea7\u30b5\u30de\u30ea\u30fc",
  assetBreakdown: "\u8cc7\u7523\u306e\u5185\u8a33",
  assetByCategory: "\u8cc7\u7523\u30b8\u30e3\u30f3\u30eb\u5225\u5185\u8a33",
  cashStatus: "\u73fe\u91d1\u306e\u72b6\u6cc1",
  columnName: "\u9298\u67c4",
  columnEvaluation: "\u8a55\u4fa1\u984d",
  columnPnl: "\u8a55\u4fa1\u640d\u76ca",
  columnBank: "\u9280\u884c\u540d",
  columnBalance: "\u6b8b\u9ad8"
} as const;

const TREND_FILTER_OPTIONS = [
  { key: "1m", label: TEXT.trendFilters[0] },
  { key: "3m", label: TEXT.trendFilters[1] },
  { key: "1y", label: TEXT.trendFilters[2] },
  { key: "all", label: TEXT.trendFilters[3] }
] as const;

type TrendFilterOption = (typeof TREND_FILTER_OPTIONS)[number];

const TREND_ASSET_OPTIONS = [
  { key: "investment", label: TEXT.trendAssetFilters[0] },
  { key: "cash", label: TEXT.trendAssetFilters[1] },
  { key: "total", label: TEXT.trendAssetFilters[2] }
] as const;

type TrendAssetOption = (typeof TREND_ASSET_OPTIONS)[number];
type TrendSeriesKey = TrendAssetOption["key"];

const BACKGROUND_OPTIONS = [
  { key: "white", label: TEXT.themeWhite, swatch: "#ffffff" },
  { key: "gray", label: TEXT.themeGray, swatch: "#d1d5db" },
  { key: "black", label: TEXT.themeBlack, swatch: "#111827" }
] as const;

type BackgroundThemeKey = (typeof BACKGROUND_OPTIONS)[number]["key"];

const BACKGROUND_THEMES: Record<BackgroundThemeKey, Record<string, string>> = {
  white: {
    "--background": "180 12.5% 96.86%",
    "--foreground": "217.24 32.58% 17.45%",
    "--sidebar": "0 0% 100%",
    "--sidebar-foreground": "217.24 32.58% 17.45%",
    "--card": "0 0% 100%",
    "--card-foreground": "217.24 32.58% 17.45%",
    "--muted": "210 11% 90%",
    "--muted-foreground": "215.38 16.32% 46.86%",
    "--accent": "215 18% 88%",
    "--accent-foreground": "217.24 32.58% 17.45%",
    "--secondary": "215 18% 88%",
    "--secondary-foreground": "217.24 32.58% 17.45%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "217.24 32.58% 17.45%",
    "--border": "213 16% 86%",
    "--input": "213 16% 86%",
    "--primary": "216.9 78.24% 53.14%",
    "--primary-foreground": "210 40% 96%",
    "--positive": "156.08 67.52% 45.88%",
    "--negative": "0 74.51% 60%",
    "--highlight": "258.31 89.53% 66.27%",
    "--warning": "47.95 95.82% 53.14%",
    "--destructive": "0 74.51% 60%",
    "--destructive-foreground": "0 0% 100%",
    "--ring": "216.9 78.24% 53.14%",
    colorScheme: "light"
  },
  gray: {
    "--background": "220 14% 86%",
    "--foreground": "217 27% 16%",
    "--sidebar": "220 12% 82%",
    "--sidebar-foreground": "217 27% 16%",
    "--card": "0 0% 100%",
    "--card-foreground": "217 27% 16%",
    "--muted": "220 10% 78%",
    "--muted-foreground": "220 15% 38%",
    "--accent": "220 12% 72%",
    "--accent-foreground": "217 27% 16%",
    "--secondary": "220 12% 72%",
    "--secondary-foreground": "217 27% 16%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "217 27% 16%",
    "--border": "220 12% 70%",
    "--input": "220 12% 70%",
    "--primary": "216.9 78.24% 53.14%",
    "--primary-foreground": "210 40% 96%",
    "--positive": "156.08 67.52% 45.88%",
    "--negative": "0 74.51% 60%",
    "--highlight": "258.31 89.53% 66.27%",
    "--warning": "47.95 95.82% 53.14%",
    "--destructive": "0 74.51% 60%",
    "--destructive-foreground": "0 0% 100%",
    "--ring": "216.9 78.24% 53.14%",
    colorScheme: "light"
  },
  black: {
    "--background": "196.67 36% 9.8%",
    "--foreground": "210 40% 98%",
    "--sidebar": "200 30.43% 13.53%",
    "--sidebar-foreground": "210 40% 96%",
    "--card": "200 30.43% 13.53%",
    "--card-foreground": "210 40% 96%",
    "--muted": "200 23% 22%",
    "--muted-foreground": "215.38 16.32% 70%",
    "--accent": "200 28% 22%",
    "--accent-foreground": "210 40% 96%",
    "--secondary": "200 28% 22%",
    "--secondary-foreground": "210 40% 96%",
    "--popover": "200 30.43% 13.53%",
    "--popover-foreground": "210 40% 96%",
    "--border": "200 28% 22%",
    "--input": "200 28% 22%",
    "--primary": "216.9 78.24% 53.14%",
    "--primary-foreground": "210 40% 96%",
    "--positive": "156.08 67.52% 45.88%",
    "--negative": "0 74.51% 60%",
    "--highlight": "258.31 89.53% 66.27%",
    "--warning": "47.95 95.82% 53.14%",
    "--destructive": "0 74.51% 60%",
    "--destructive-foreground": "210 40% 96%",
    "--ring": "216.9 78.24% 53.14%",
    colorScheme: "dark"
  }
};
const NAV_ITEMS = [
  { label: TEXT.navDashboard, icon: LayoutDashboard, active: true },
  { label: TEXT.navPortfolio, icon: PieChartIcon, active: false }
];

const tooltipStyles: CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
  borderRadius: "0.75rem",
  border: "1px solid hsl(var(--border))",
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.12)",
  padding: "0.75rem 1rem"
};

const syncDateFormatter = (iso: string | null) => {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const min = `${date.getMinutes()}`.padStart(2, "0");
  return `${yyyy}\u5e74${mm}\u6708${dd}\u65e5 ${hh}:${min}`;
};

export function DashboardView(props: DashboardViewProps) {
  const { metrics, lastSyncedAt, portfolio, trend, accounts, holdings, cash, connectableAccounts } = props;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedTrendFilter, setSelectedTrendFilter] = useState<TrendFilterOption>(TREND_FILTER_OPTIONS[2]);
  const [selectedTrendAsset, setSelectedTrendAsset] = useState<TrendAssetOption>(TREND_ASSET_OPTIONS[2]);
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundThemeKey>("white");
  const [showSnapshotConfirm, setShowSnapshotConfirm] = useState(false);
  const [showScopedSnapshotConfirm, setShowScopedSnapshotConfirm] = useState(false);
  const [isPurgingSnapshots, setIsPurgingSnapshots] = useState(false);
  const [snapshotPurgeFeedback, setSnapshotPurgeFeedback] = useState<SnapshotPurgeFeedback | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState(connectableAccounts);
  const [targetedSnapshotAccountId, setTargetedSnapshotAccountId] = useState(
    () => connectableAccounts[0]?.id ?? ""
  );

  const buildSnapshotPurgeSuccessMessage = (
    counts?: SnapshotPurgeCounts | null,
    prefix?: string
  ) => {
    const baseMessage = prefix ?? TEXT.deleteSnapshotsSuccess;
    if (!counts) {
      return baseMessage;
    }
    const segments: string[] = [];
    if (typeof counts.accountSnapshots === "number") {
      segments.push(`${TEXT.deleteSnapshotsAccountLabel}: ${counts.accountSnapshots}`);
    }
    if (typeof counts.holdingSnapshots === "number") {
      segments.push(`${TEXT.deleteSnapshotsHoldingLabel}: ${counts.holdingSnapshots}`);
    }
    if (typeof counts.rateSnapshots === "number") {
      segments.push(`${TEXT.deleteSnapshotsRateLabel}: ${counts.rateSnapshots}`);
    }
    if (segments.length === 0) {
      return baseMessage;
    }
    return `${baseMessage} (${segments.join(" / ")})`;
  };

  const handleSnapshotPurgeRequest = () => {
    setSnapshotPurgeFeedback(null);
    setShowScopedSnapshotConfirm(false);
    setShowSnapshotConfirm(true);
  };

  const handleSnapshotPurgeCancel = () => {
    if (isPurgingSnapshots) {
      return;
    }
    setShowSnapshotConfirm(false);
  };

  const handleScopedSnapshotPurgeRequest = () => {
    if (!targetedSnapshotAccountId) {
      setSnapshotPurgeFeedback({
        type: "error",
        message: TEXT.deleteSnapshotsScopedRequireAccount
      });
      return;
    }
    setSnapshotPurgeFeedback(null);
    setShowSnapshotConfirm(false);
    setShowScopedSnapshotConfirm(true);
  };

  const handleScopedSnapshotPurgeCancel = () => {
    if (isPurgingSnapshots) {
      return;
    }
    setShowScopedSnapshotConfirm(false);
  };

  useEffect(() => {
    if (availableAccounts.length === 0) {
      setTargetedSnapshotAccountId("");
      setShowScopedSnapshotConfirm(false);
      return;
    }
    setTargetedSnapshotAccountId((prev) =>
      prev && availableAccounts.some((account) => account.id === prev) ? prev : availableAccounts[0].id
    );
  }, [availableAccounts]);

  const handleSnapshotPurgeConfirm = async () => {
    setIsPurgingSnapshots(true);
    setSnapshotPurgeFeedback(null);
    try {
      const response = await fetch("/api/snapshots/purge", { method: "DELETE" });
      let payload: { counts?: SnapshotPurgeCounts; error?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? "failed to purge snapshots");
      }
      setSnapshotPurgeFeedback({
        type: "success",
        message: buildSnapshotPurgeSuccessMessage(payload?.counts)
      });
      setShowSnapshotConfirm(false);
    } catch (error) {
      console.error(error);
      setSnapshotPurgeFeedback({
        type: "error",
        message: TEXT.deleteSnapshotsError
      });
    } finally {
      setIsPurgingSnapshots(false);
    }
  };

  const handleScopedSnapshotPurgeConfirm = async () => {
    if (!targetedSnapshotAccountId) {
      setSnapshotPurgeFeedback({
        type: "error",
        message: TEXT.deleteSnapshotsScopedRequireAccount
      });
      setShowScopedSnapshotConfirm(false);
      return;
    }
    setIsPurgingSnapshots(true);
    setSnapshotPurgeFeedback(null);
    const targetId = targetedSnapshotAccountId;
    const targetAccount =
      availableAccounts.find((account) => account.id === targetId) ?? null;
    const successPrefix = targetAccount?.name
      ? `${TEXT.deleteSnapshotsScopedSuccess} (${targetAccount.name})`
      : TEXT.deleteSnapshotsScopedSuccess;

    try {
      const response = await fetch(
        `/api/snapshots/purge?accountId=${encodeURIComponent(targetId)}`,
        { method: "DELETE" }
      );
      let payload: { counts?: SnapshotPurgeCounts; error?: string } | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? "failed to purge snapshots");
      }
      setSnapshotPurgeFeedback({
        type: "success",
        message: buildSnapshotPurgeSuccessMessage(payload?.counts, successPrefix)
      });
      setShowScopedSnapshotConfirm(false);
      const updatedAccounts = availableAccounts.filter((account) => account.id !== targetId);
      setAvailableAccounts(updatedAccounts);
      setTargetedSnapshotAccountId((current) =>
        current === targetId ? updatedAccounts[0]?.id ?? "" : current
      );
    } catch (error) {
      console.error(error);
      setSnapshotPurgeFeedback({
        type: "error",
        message: TEXT.deleteSnapshotsError
      });
    } finally {
      setIsPurgingSnapshots(false);
    }
  };

  useEffect(() => {
    if (!settingsOpen) {
      setShowSnapshotConfirm(false);
      setShowScopedSnapshotConfirm(false);
    }
  }, [settingsOpen]);

  const themeStyle = useMemo(() => {
    const styleMap = BACKGROUND_THEMES[backgroundTheme];
    const style: CSSProperties = {};
    Object.entries(styleMap).forEach(([key, value]) => {
      (style as Record<string, string>)[key] = value;
    });
    return style;
  }, [backgroundTheme]);

  const totalAssetsMan = formatCurrencyJPY(metrics.totalAssets, { mode: "man" });
  const totalAssetsManValue = totalAssetsMan.endsWith(TEXT.unitMan) ? totalAssetsMan.replace(TEXT.unitMan, "") : totalAssetsMan;
  const investmentAmount = formatCurrencyJPY(metrics.investmentAmount);
  const profitLoss = formatCurrencyJPY(metrics.profitLoss, { showSign: true });
  const syncedAt = syncDateFormatter(lastSyncedAt);
  const scopedSnapshotAccount =
    availableAccounts.find((account) => account.id === targetedSnapshotAccountId) ?? null;

  const pieData = useMemo(() => {
    const total = portfolio.reduce((sum, item) => sum + item.value, 0);
    return portfolio.map((item) => ({
      name: item.name,
      value: item.value,
      color: item.color,
      ratio: total === 0 ? 0 : (item.value / total) * 100
    }));
  }, [portfolio]);

  const sortedTrend = useMemo(() => {
    return [...trend].sort((a, b) => {
      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      return safeATime - safeBTime;
    });
  }, [trend]);

  const timeFilteredTrend = useMemo(() => {
    if (selectedTrendFilter.key === "all") {
      if (sortedTrend.length === 0) {
        return sortedTrend;
      }
      const latestPoint = sortedTrend[sortedTrend.length - 1];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const latestDate = new Date(latestPoint.date);
      latestDate.setHours(0, 0, 0, 0);
      if (!Number.isNaN(latestDate.getTime()) && today.getTime() > latestDate.getTime()) {
        return [
          ...sortedTrend,
          {
            ...latestPoint,
            date: today.toISOString(),
            label: TREND_LABEL_FORMATTER.format(today),
            hasSnapshot: false
          }
        ];
      }
      return sortedTrend;
    }

    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);

    if (selectedTrendFilter.key === "1m") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (selectedTrendFilter.key === "3m") {
      startDate.setMonth(startDate.getMonth() - 3);
    } else if (selectedTrendFilter.key === "1y") {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    startDate.setHours(0, 0, 0, 0);

    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const entriesByDay = new Map<string, TrendPoint>();

    sortedTrend.forEach((point) => {
      const pointDate = new Date(point.date);
      if (Number.isNaN(pointDate.getTime())) {
        return;
      }
      const normalized = new Date(pointDate);
      normalized.setHours(0, 0, 0, 0);
      const time = normalized.getTime();
      if (time < startTime || time > endTime) {
        return;
      }
      const dayKey = normalized.toISOString().slice(0, 10);
      entriesByDay.set(dayKey, {
        ...point,
        date: normalized.toISOString(),
        label: TREND_LABEL_FORMATTER.format(normalized)
      });
    });

    const entryTimes = Array.from(entriesByDay.values())
      .map((entry) => {
        const time = new Date(entry.date).getTime();
        return Number.isNaN(time) ? null : time;
      })
      .filter((time): time is number => time !== null);

    const firstEntryTime = entryTimes.length > 0 ? Math.min(...entryTimes) : null;

    let lastSnapshotTotals: { total: number; investment: number; cash: number } | null = null;
    sortedTrend.forEach((point) => {
      const pointDate = new Date(point.date);
      if (Number.isNaN(pointDate.getTime())) {
        return;
      }
      const normalized = new Date(pointDate);
      normalized.setHours(0, 0, 0, 0);
      const time = normalized.getTime();
      if (time <= startTime && point.hasSnapshot) {
        lastSnapshotTotals = {
          total: point.total,
          investment: point.investment,
          cash: point.cash
        };
      }
    });

    const timeline: TrendPoint[] = [];
    const lastKnown = { ...((lastSnapshotTotals ?? { total: 0, investment: 0, cash: 0 })) };

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    for (let time = startTime; time <= endTime; time += ONE_DAY_MS) {
      const current = new Date(time);
      const key = current.toISOString().slice(0, 10);
      const source = entriesByDay.get(key);
      const isBeforeFirstSnapshot = firstEntryTime !== null && time < firstEntryTime;
      if (source) {
        const enriched: TrendPoint = {
          ...source,
          date: current.toISOString(),
          label: TREND_LABEL_FORMATTER.format(current),
          ...(isBeforeFirstSnapshot ? { isBeforeFirstSnapshot: true } : {})
        };
        timeline.push(enriched);
        if (!isBeforeFirstSnapshot) {
          lastKnown.total = source.total;
          lastKnown.investment = source.investment;
          lastKnown.cash = source.cash;
        }
      } else {
        timeline.push({
          date: current.toISOString(),
          label: TREND_LABEL_FORMATTER.format(current),
          total: lastKnown.total,
          investment: lastKnown.investment,
          cash: lastKnown.cash,
          hasSnapshot: false,
          ...(isBeforeFirstSnapshot ? { isBeforeFirstSnapshot: true } : {})
        });
      }
    }

    return timeline;
  }, [sortedTrend, selectedTrendFilter]);

  const chartTrend = useMemo(() => {
    const seriesKey: TrendSeriesKey = selectedTrendAsset.key;

    return timeFilteredTrend.map((point) => ({
      ...point,
      value: point.isBeforeFirstSnapshot ? undefined : point[seriesKey]
    }));
  }, [timeFilteredTrend, selectedTrendAsset]);

  const totalPortfolioValue = useMemo(
    () => portfolio.reduce((sum, item) => sum + item.value, 0),
    [portfolio]
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground" style={themeStyle}>
      <aside className="hidden w-[260px] flex-col justify-between bg-sidebar p-8 shadow-xl lg:flex">
        <div>
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.923 3.5c-.592 0-1.143.315-1.437.824L2.5 9l3 5.176c.294.509.845.824 1.437.824h3.154L12 21l2.909-5.928h3.168c.592 0 1.143-.315 1.437-.824L22 9l-3-5.176A1.666 1.666 0 0 0 17.563 3H6.923z"
                  fill="currentColor"
                />
              </svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight">DripGraph</span>
          </div>

          <div className="mb-6 space-y-1">
            <p className="text-sm text-muted-foreground">{TEXT.totalAssets}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">{totalAssetsManValue}</span>
              <span className="text-lg font-semibold text-muted-foreground">{TEXT.unitMan}</span>
            </div>
          </div>

          <div className="mb-4 space-y-1">
            <p className="text-sm text-muted-foreground">{TEXT.investmentAmount}</p>
            <p className="text-lg font-semibold">{investmentAmount}</p>
          </div>

          <div className="mb-8 space-y-1">
            <p className="text-sm text-muted-foreground">{TEXT.cumulativePnl}</p>
            <p className={cn("text-lg font-semibold", metrics.profitLoss >= 0 ? "text-positive" : "text-negative")}>
              {profitLoss}
            </p>
          </div>

          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
                    item.active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                  href="#"
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
          {TEXT.settings}
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background px-6 py-8 lg:px-12">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{TEXT.dashboardTitle}</h1>
            <p className="text-sm text-muted-foreground">{TEXT.lastSynced}: {syncedAt}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
              onClick={() => setHistoryDialogOpen(true)}
            >
              <CalendarDays className="h-5 w-5" />
              {TEXT.historyButton}
            </Button>
            <Button
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-5 w-5" />
              {TEXT.connectButton}
            </Button>
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:hidden">
          <Card className="border-0 bg-card shadow-md shadow-primary/10">
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{TEXT.totalAssets}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">{totalAssetsMan}</p>
              <p className="text-xs text-muted-foreground">{formatCurrencyJPY(metrics.totalAssets)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-card shadow-md shadow-primary/10">
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{TEXT.investmentAmount}</p>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">{investmentAmount}</p>
            </CardContent>
          </Card>
          <Card className="border-0 bg-card shadow-md shadow-primary/10">
            <CardHeader className="pb-2">
              <p className="text-xs text-muted-foreground">{TEXT.cumulativePnl}</p>
            </CardHeader>
            <CardContent>
              <p
                className={
                  cn("text-2xl font-bold tracking-tight", metrics.profitLoss >= 0 ? "text-positive" : "text-negative")
                }
              >
                {profitLoss}
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <Card className="border-0 bg-card shadow-xl shadow-primary/5">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold">{TEXT.portfolioTitle}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[240px,1fr]">
                <div className="mx-auto flex w-full max-w-[240px] flex-col items-center justify-center">
                  <div className="relative h-56 w-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" innerRadius="68%" outerRadius="90%" strokeWidth={3} paddingAngle={2}>
                          {pieData.map((item) => (
                            <Cell key={item.name} fill={item.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          cursor={{ fill: "transparent" }}
                          contentStyle={tooltipStyles}
                          formatter={(value: number, _name, entry) => [
                            `${formatCurrencyJPY(value as number)} (${(entry?.payload?.ratio ?? 0).toFixed(0)}%)`,
                            entry?.payload?.name ?? ""
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <span className="text-sm font-medium text-muted-foreground">{TEXT.totalAssets}</span>
                      <span className="text-2xl font-bold tracking-tight">{totalAssetsMan}</span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-sm text-muted-foreground">{item.name}</p>
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrencyJPY(item.value)} ({item.ratio.toFixed(0)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-card shadow-xl shadow-primary/5">
              <CardHeader className="pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <CardTitle className="text-xl font-bold">{TEXT.assetTrendTitle}</CardTitle>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <div className="flex gap-2 rounded-full bg-muted p-1 text-sm">
                      {TREND_ASSET_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={cn(
                            "rounded-full px-3 py-1 transition",
                            option.key === selectedTrendAsset.key
                              ? "bg-card text-primary shadow-sm"
                              : "text-muted-foreground hover:bg-card"
                          )}
                          onClick={() => setSelectedTrendAsset(option)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 rounded-full bg-muted p-1 text-sm">
                      {TREND_FILTER_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={cn(
                            "rounded-full px-3 py-1 transition",
                            option.key === selectedTrendFilter.key
                              ? "bg-card text-primary shadow-sm"
                              : "text-muted-foreground hover:bg-card"
                          )}
                          onClick={() => setSelectedTrendFilter(option)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartTrend}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--muted))" strokeDasharray="4 8" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={tooltipStyles}
                      formatter={(value: number | string) => {
                        if (value == null) {
                          return "-";
                        }
                        if (typeof value === "number") {
                          return formatCurrencyJPY(value);
                        }
                        const numeric = Number(value);
                        return Number.isFinite(numeric) ? formatCurrencyJPY(numeric) : "-";
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#trendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="border-0 bg-card shadow-xl shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold">{TEXT.accountSummary}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {accounts.map((account) => (
                  <div key={account.name} className="rounded-2xl border border-border px-4 py-3">
                    <p className="text-sm text-muted-foreground">{account.name}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">{formatCurrencyJPY(account.balance)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-0 bg-card shadow-xl shadow-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-bold">{TEXT.assetBreakdown}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {portfolio.map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{formatCurrencyJPY(item.value)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${totalPortfolioValue === 0 ? 0 : Math.max(Math.round((item.value / totalPortfolioValue) * 100), 4)}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-0 bg-card shadow-xl shadow-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">{TEXT.assetByCategory}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[480px] divide-y divide-border text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">{TEXT.columnName}</th>
                    <th className="px-6 py-3 text-right font-medium">{TEXT.columnEvaluation}</th>
                    <th className="px-6 py-3 text-right font-medium">{TEXT.columnPnl}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holdings.map((row) => (
                    <tr key={row.name}>
                      <td className="px-6 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{formatCurrencyJPY(row.evaluation)}</td>
                      <td className={cn("px-6 py-3 text-right font-semibold", row.profitLoss >= 0 ? "text-positive" : "text-negative")}>{formatCurrencyJPY(row.profitLoss, { showSign: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="border-0 bg-card shadow-xl shadow-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">{TEXT.cashStatus}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[360px] divide-y divide-border text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">{TEXT.columnBank}</th>
                    <th className="px-6 py-3 text-right font-medium">{TEXT.columnBalance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cash.map((row) => (
                    <tr key={row.bank}>
                      <td className="px-6 py-3 font-medium text-foreground">{row.bank}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{formatCurrencyJPY(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        <ConnectAccountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          accounts={availableAccounts}
          onSyncComplete={() => setDialogOpen(false)}
        />
        <ManualHistoricalSnapshotDialog
          open={historyDialogOpen}
          onOpenChange={setHistoryDialogOpen}
          accounts={availableAccounts}
        />
      </main>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/20">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">{TEXT.settingsTitle}</h2>
              <button
                type="button"
                aria-label={TEXT.settingsClose}
                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => setSettingsOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <p className="text-sm text-muted-foreground">{TEXT.settingsDescription}</p>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{TEXT.settingsThemeLabel}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {BACKGROUND_OPTIONS.map((option) => {
                    const isActive = option.key === backgroundTheme;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setBackgroundTheme(option.key)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border px-4 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                          isActive ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        <span
                          className="h-10 w-10 rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: option.swatch }}
                        />
                        <span className="text-sm font-semibold">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">{TEXT.deleteSnapshotsTitle}</p>
                    <p className="text-xs text-muted-foreground">{TEXT.deleteSnapshotsDescription}</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Button
                      variant="destructive"
                      onClick={handleSnapshotPurgeRequest}
                      disabled={isPurgingSnapshots}
                      className="w-full sm:w-auto"
                    >
                      {isPurgingSnapshots ? TEXT.deleteSnapshotsInProgress : TEXT.deleteSnapshotsButton}
                    </Button>
                    {showSnapshotConfirm ? (
                      <div className="rounded-xl border border-destructive/50 bg-card px-4 py-3 shadow-inner shadow-destructive/10">
                        <p className="text-sm font-semibold text-foreground">{TEXT.deleteSnapshotsConfirm}</p>
                        <p className="text-xs text-muted-foreground">{TEXT.deleteSnapshotsWarning}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleSnapshotPurgeConfirm}
                            disabled={isPurgingSnapshots}
                          >
                            {isPurgingSnapshots ? TEXT.deleteSnapshotsInProgress : TEXT.deleteSnapshotsYes}
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleSnapshotPurgeCancel} disabled={isPurgingSnapshots}>
                            {TEXT.deleteSnapshotsNo}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/60 px-4 py-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{TEXT.deleteSnapshotsScopedTitle}</p>
                    <p className="text-xs text-muted-foreground">{TEXT.deleteSnapshotsScopedDescription}</p>
                  </div>
                  {availableAccounts.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">{TEXT.deleteSnapshotsScopedNoAccount}</p>
                  ) : (
                    <>
                      <div className="mt-3 space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground" htmlFor="snapshot-scope-account">
                          {TEXT.deleteSnapshotsScopedSelectLabel}
                        </label>
                        <select
                          id="snapshot-scope-account"
                          value={targetedSnapshotAccountId}
                          onChange={(event) => setTargetedSnapshotAccountId(event.target.value)}
                          disabled={isPurgingSnapshots}
                          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {targetedSnapshotAccountId.length === 0 ? (
                            <option value="">{TEXT.deleteSnapshotsScopedPlaceholder}</option>
                          ) : null}
                          {availableAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-4 space-y-3">
                        <Button
                          variant="destructive"
                          onClick={handleScopedSnapshotPurgeRequest}
                          disabled={isPurgingSnapshots || targetedSnapshotAccountId.length === 0}
                          className="w-full sm:w-auto"
                        >
                          {isPurgingSnapshots ? TEXT.deleteSnapshotsInProgress : TEXT.deleteSnapshotsScopedButton}
                        </Button>
                        {showScopedSnapshotConfirm ? (
                          <div className="rounded-xl border border-destructive/50 bg-card px-4 py-3 shadow-inner shadow-destructive/10">
                            <p className="text-sm font-semibold text-foreground">
                              {TEXT.deleteSnapshotsScopedConfirm.replace(
                                "{account}",
                                scopedSnapshotAccount?.name ?? TEXT.deleteSnapshotsScopedPlaceholder
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{TEXT.deleteSnapshotsScopedWarning}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleScopedSnapshotPurgeConfirm}
                                disabled={isPurgingSnapshots}
                              >
                                {isPurgingSnapshots ? TEXT.deleteSnapshotsInProgress : TEXT.deleteSnapshotsYes}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleScopedSnapshotPurgeCancel}
                                disabled={isPurgingSnapshots}
                              >
                                {TEXT.deleteSnapshotsNo}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
                {snapshotPurgeFeedback ? (
                  <p
                    className={cn(
                      "mt-3 text-xs font-semibold",
                      snapshotPurgeFeedback.type === "success" ? "text-positive" : "text-negative"
                    )}
                  >
                    {snapshotPurgeFeedback.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex justify-end border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                {TEXT.settingsClose}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
