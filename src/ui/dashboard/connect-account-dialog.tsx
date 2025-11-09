"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  PROVIDER_CONFIG,
  SECURITIES_PROVIDER_OPTIONS,
  type ProviderKey,
  type ProviderKind
} from "@/config/providers";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { parseNumericInput, sanitizeNumericInput } from "./numeric-input";

const TEXT = {
  securitiesTab: "\u8a3c\u5238\u53e3\u5ea7",
  bankTab: "\u9280\u884c\u53e3\u5ea7",
  dialogTitle: "\u53e3\u5ea7\u3092\u9023\u643a",
  dialogDescription:
    "\u8a3c\u5238\u53e3\u5ea7/\u9280\u884c\u53e3\u5ea7\u3092\u9078\u629e\u3057\u3001\u30dc\u30bf\u30f3\u3092\u62bc\u3059\u3068\u30d6\u30e9\u30a6\u30b6\u304c\u8d77\u52d5\u3057\u307e\u3059\u3002",
  manualDialogDescription:
    "\u9280\u884c\u53e3\u5ea7\u306f\u6b8b\u9ad8\u3092\u5165\u529b\u3057\u3066\u73fe\u91d1\u8cc7\u7523\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3092\u8ffd\u52a0\u3067\u304d\u307e\u3059\u3002",
  manualInvestmentDialogDescription:
    "\u8a3c\u5238\u53e3\u5ea7\u306f\u8a55\u4fa1\u984d\u3068\u3044\u3063\u3057\u3087\u306b\u8a55\u4fa1\u640d\u76ca\u307e\u305f\u306f\u640d\u76ca\u7387\u3092\u5165\u529b\u3057\u3066\u904b\u7528\u8cc7\u7523\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u306b\u8ffd\u52a0\u3067\u304d\u307e\u3059\u3002",
  closeDialog: "\u30c0\u30a4\u30a2\u30ed\u30b0\u3092\u9589\u3058\u308b",
  selectedAccount: "\u9078\u629e\u4e2d\u306e\u53e3\u5ea7",
  providerListTitle: "\u9023\u643a\u5148",
  manualAccountListTitle: "\u767b\u9332\u6e08\u307f\u53e3\u5ea7 (\u4efb\u610f)",
  workflowTitle: "\u9023\u643a\u624b\u9806",
  workflowStep1:
    "\u30dc\u30bf\u30f3\u3092\u62bc\u3059\u3068\u30d6\u30e9\u30a6\u30b6\u304c\u8d77\u52d5\u3057\u307e\u3059\u3002\u8d77\u52d5\u3057\u305f\u753b\u9762\u3067\u5bfe\u8c61\u53e3\u5ea7\u306b\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  workflowStep2:
    "\u8a8d\u8a3c\u3092\u5b8c\u4e86\u3059\u308b\u3068\u81ea\u52d5\u3067\u6700\u65b0\u60c5\u5831\u306e\u53d6\u5f97\u3092\u958b\u59cb\u3057\u307e\u3059\u3002",
  workflowStep3: "\u53d6\u5f97\u304c\u5b8c\u4e86\u3059\u308b\u3068\u7d50\u679c\u304c\u53cd\u6620\u3055\u308c\u307e\u3059\u3002",
  workflowHintRakuten:
    "\u697d\u5929\u8a3c\u5238\u3067\u30ed\u30b0\u30a4\u30f3\u5f8c\u306b\u30a8\u30e9\u30fc\u304c\u8868\u793a\u3055\u308c\u305f\u3089\u3001\u30d6\u30e9\u30a6\u30b6\u306e\u300c\u623b\u308b\u300d\u30dc\u30bf\u30f3\u3067\u30db\u30fc\u30e0\u753b\u9762\u3092\u958b\u304d\u76f4\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  workflowHintSbi: "\u0053\u0042\u0049\u30cd\u30c3\u30c8\u8a3c\u5238\u3067\u306f\u30ed\u30b0\u30a4\u30f3\u5f8c\u306b\u300c\u004d\u0079\u8cc7\u7523\u300d\u3092\u958b\u3044\u3066\u304f\u3060\u3055\u3044\u3002",
  statusIdle: "\u9023\u643a\u3092\u958b\u59cb\u3059\u308b\u3068\u30d6\u30e9\u30a6\u30b6\u304c\u958b\u304d\u307e\u3059\u3002",
  syncButton: "\u9023\u643a\u3092\u958b\u59cb",
  syncing: "\u9023\u643a\u51e6\u7406\u4e2d\u2026",
  cancelButton: "\u30ad\u30e3\u30f3\u30bb\u30eb",
  statusLogs: "\u30ed\u30b0",
  errorNoKind: "\u9023\u643a\u3059\u308b\u53e3\u5ea7\u7a2e\u5225\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044",
  errorNoAccount:
    "\u9023\u643a\u5bfe\u8c61\u306e\u53e3\u5ea7\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002\u53e3\u5ea7\u7ba1\u7406\u3067\u767b\u9332\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  statusAwaitLogin:
    "\u30d6\u30e9\u30a6\u30b6\u3092\u8d77\u52d5\u3057\u307e\u3057\u305f\u3002\u958b\u3044\u305f\u753b\u9762\u3067\u53e3\u5ea7\u306b\u30ed\u30b0\u30a4\u30f3\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u30db\u30fc\u30e0\u753b\u9762\u306b\u5230\u9054\u3059\u308b\u3068\u81ea\u52d5\u3067\u53d6\u5f97\u3092\u958b\u59cb\u3057\u307e\u3059\u3002",
  statusErrorDefault: "\u9023\u643a\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  statusSuccess: "\u9023\u643a\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\u3002\u6700\u65b0\u306e\u8cc7\u7523\u60c5\u5831\u3092\u53d6\u5f97\u3057\u3066\u3044\u307e\u3059\u3002",
  statusErrorUnexpected: "\u9023\u643a\u4e2d\u306b\u4e88\u671f\u305b\u306c\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002",
  statusLogsTitle: "\u30ed\u30b0",
  lastSynced: "\u6700\u7d42\u540c\u671f",
  notSynced: "\u672a\u540c\u671f",
  notSelected: "\u672a\u9078\u629e",
  statusCancelled: "\u9023\u643a\u3092\u4e2d\u65ad\u3057\u307e\u3057\u305f\u3002\u518d\u5ea6\u5b9f\u884c\u3059\u308b\u5834\u5408\u306f\u53e3\u5ea7\u3092\u9078\u629e\u3057\u76f4\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  statusTimeout: "\u9023\u643a\u304c10\u5206\u4ee5\u4e0a\u7d4c\u904e\u3057\u305f\u305f\u3081\u81ea\u52d5\u4e2d\u6b62\u3057\u307e\u3057\u305f\u3002\u518d\u5ea6\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  errorEnsureAccount: "\u65b0\u898f\u53e3\u5ea7\u306e\u4f5c\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  manualSnapshotTitle: "\u73fe\u91d1\u8cc7\u7523\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8",
  manualInvestmentSnapshotTitle: "\u904b\u7528\u8cc7\u7523\u306e\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8",
  manualNameLabel: "\u53e3\u5ea7\u540d",
  manualNamePlaceholder: "\u4f8b\u3048\u3070\u300c\u25cb\u25cb\u9280\u884c \u666e\u901a\u300d",
  manualInvestmentNamePlaceholder: "\u4f8b\u3048\u3070\u300cNISA(\u624b\u5165\u529b)\u300d",
  manualAmountLabel: "\u6b8b\u9ad8(\u5186)",
  manualAmountPlaceholder: "\u4f8b\u3048\u3070 1851511",
  manualInvestmentAmountLabel: "\u8a55\u4fa1\u984d(\u5186)",
  manualInvestmentAmountPlaceholder: "\u4f8b\u3048\u3070 500000",
  manualInvestmentProfitLabel: "\u8a55\u4fa1\u640d\u76ca(\u5186)",
  manualInvestmentProfitPlaceholder: "\u4f8b\u3048\u3070 85000",
  manualInvestmentProfitRateLabel: "\u640d\u76ca\u7387(%)",
  manualInvestmentProfitRatePlaceholder: "\u4f8b\u3048\u3070 5.5",
  snapshotButton: "\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u306b\u8ffd\u52a0",
  snapshotSaving: "\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3092\u4fdd\u5b58\u4e2d…",
  statusManualIdle: "\u53e3\u5ea7\u540d\u3068\u6b8b\u9ad8\u3092\u5165\u529b\u3057\u3066\u73fe\u91d1\u8cc7\u7523\u306b\u8ffd\u52a0\u3057\u307e\u3059\u3002",
  statusManualSubmitting: "\u73fe\u91d1\u8cc7\u7523\u3092\u4fdd\u5b58\u3057\u3066\u3044\u307e\u3059\u2026",
  statusManualSuccess: "\u73fe\u91d1\u8cc7\u7523\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002",
  statusManualError: "\u73fe\u91d1\u8cc7\u7523\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  statusManualInvestmentIdle: "\u53e3\u5ea7\u540d\u3068\u8a55\u4fa1\u984d\u3092\u5165\u529b\u3057\u3001\u5fc5\u8981\u306b\u5fdc\u3058\u3066\u8a55\u4fa1\u640d\u76ca\u307e\u305f\u306f\u640d\u76ca\u7387\u3092\u8ffd\u52a0\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  statusManualInvestmentSubmitting: "\u904b\u7528\u8cc7\u7523\u3092\u4fdd\u5b58\u3057\u3066\u3044\u307e\u3059\u2026",
  statusManualInvestmentSuccess: "\u904b\u7528\u8cc7\u7523\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002",
  statusManualInvestmentError: "\u904b\u7528\u8cc7\u7523\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002",
  statusManualCancelled: "\u5165\u529b\u3092\u30ea\u30bb\u30c3\u30c8\u3057\u307e\u3057\u305f\u3002",
  errorManualNoName: "\u53e3\u5ea7\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  errorManualInvalidAmount: "\u6b8b\u9ad8\u306b\u6570\u5024\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  manualAccountEmpty: "\u767b\u9332\u6e08\u307f\u306e\u53e3\u5ea7\u306f\u3042\u308a\u307e\u305b\u3093\u3002",
  manualInvestmentAccountListTitle: "\u767b\u9332\u6e08\u307f\u53e3\u5ea7 (\u305d\u306e\u4ed6)"
} as const;

const formatAmountInput = (value: number) => {
  const rounded = Math.round(value);
  return Number.isFinite(rounded) ? rounded.toString() : "";
};

const formatRateInput = (value: number) => {
  if (!Number.isFinite(value)) {
    return "";
  }
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, "");
};

const computeRateFromAmount = (marketValue: number | null, profitAmount: number | null) => {
  if (marketValue == null || profitAmount == null) {
    return "";
  }
  const cost = marketValue - profitAmount;
  if (cost <= 0) {
    return "";
  }
  const rate = (profitAmount / cost) * 100;
  return formatRateInput(rate);
};

const computeAmountFromRate = (marketValue: number | null, profitRate: number | null) => {
  if (marketValue == null || profitRate == null) {
    return "";
  }
  const denominator = 1 + profitRate / 100;
  if (denominator <= 0) {
    return "";
  }
  const cost = marketValue / denominator;
  const profitAmount = marketValue - cost;
  return formatAmountInput(profitAmount);
};

type AccountRecord = {
  id: string;
  name: string;
  provider: ProviderKey;
  method: string;
  lastSyncedAt: string | null;
};

const RETRY_DELAY_BASE = 5000;
const RETRY_DELAY_MAX = 20000;
const MAX_AUTO_SYNC_DURATION = 600_000;

type ConnectAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountRecord[];
  onSyncComplete?: () => void;
};

type SyncStatus =
  | { state: "progress"; message: string; logs?: string[] }
  | { state: "success"; message: string; logs?: string[] }
  | { state: "error"; message: string; logs?: string[] };

const formatSyncedLabel = (iso: string | null) => {
  if (!iso) return TEXT.notSynced;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return TEXT.notSynced;
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  return `${yyyy}\u5e74${mm}\u6708${dd}\u65e5`;
};

const formatStatusRetry = (attempt: number) => `\u30ed\u30b0\u30a4\u30f3\u72b6\u614b\u3092\u78ba\u8a8d\u4e2d\u2026 (\u518d\u8a66\u884c ${attempt})`;

export function ConnectAccountDialog(props: ConnectAccountDialogProps) {
  const { open, onOpenChange, accounts, onSyncComplete } = props;
  const router = useRouter();
  const [activeKind, setActiveKind] = useState<ProviderKind>("securities");
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isAutoSyncActive, setIsAutoSyncActive] = useState(false);
  const [accountRecords, setAccountRecords] = useState(accounts);
  const [manualBankName, setManualBankName] = useState("");
  const [manualBankAmount, setManualBankAmount] = useState("");
  const [manualBankAccountId, setManualBankAccountId] = useState<string | null>(null);
  const [manualSecuritiesName, setManualSecuritiesName] = useState("");
  const [manualSecuritiesAmount, setManualSecuritiesAmount] = useState("");
  const [manualSecuritiesAccountId, setManualSecuritiesAccountId] = useState<string | null>(null);
  const [manualSecuritiesProfitAmount, setManualSecuritiesProfitAmount] = useState("");
  const [manualSecuritiesProfitRate, setManualSecuritiesProfitRate] = useState("");
  const [manualSecuritiesPrimaryField, setManualSecuritiesPrimaryField] = useState<"amount" | "rate" | null>(null);
  const isManualBank = activeKind === "bank";
  const isManualSecurities = activeKind === "securities" && selectedProvider === "manual-securities";
  const isManualMode = isManualBank || isManualSecurities;

  useEffect(() => {
    setAccountRecords(accounts);
  }, [accounts]);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);
  const [activeController, setActiveControllerState] = useState<AbortController | null>(null);
  const syncStartTimeRef = useRef<number | null>(null);

  const setActiveController = useCallback((controller: AbortController | null) => {
    activeControllerRef.current = controller;
    setActiveControllerState(controller);
  }, []);

  const providerOptions = useMemo(
    () => (activeKind === "securities" ? SECURITIES_PROVIDER_OPTIONS : []),
    [activeKind]
  );

  const accountsForKind = useMemo(
    () =>
      accountRecords.filter((account) => {
        const provider = PROVIDER_CONFIG[account.provider];
        const fallbackKind =
          provider?.kind ??
          (account.method === "manual-snapshot" || account.method === "manual-scrape"
            ? "bank"
            : "securities");
        return fallbackKind === activeKind;
      }),
    [accountRecords, activeKind]
  );

  const manualSecuritiesAccounts = useMemo(
    () => accountsForKind.filter((account) => account.provider === "manual-securities"),
    [accountsForKind]
  );

  const accountsForProvider = useMemo(
    () =>
      accountsForKind.filter((account) => (selectedProvider ? account.provider === selectedProvider : true)),
    [accountsForKind, selectedProvider]
  );

  useEffect(() => {
    if (!open) {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      setActiveControllerState(null);
      setIsAutoSyncActive(false);
      setStatus(null);
      syncStartTimeRef.current = null;
      setManualBankName("");
      setManualBankAmount("");
      setManualBankAccountId(null);
      setManualSecuritiesName("");
      setManualSecuritiesAmount("");
      setManualSecuritiesAccountId(null);
      setManualSecuritiesProfitAmount("");
      setManualSecuritiesProfitRate("");
      setManualSecuritiesPrimaryField(null);
    }
  }, [open]);

  useEffect(() => {
    if (activeKind !== "bank") {
      return;
    }
    if (manualBankName.trim().length === 0) {
      const firstAccount = accountsForKind[0] ?? null;
      if (firstAccount) {
        setManualBankAccountId(firstAccount.id);
        setManualBankName(firstAccount.name);
        setManualBankAmount("");
      } else {
        setManualBankAccountId(null);
        setManualBankName("");
        setManualBankAmount("");
      }
    } else if (accountsForKind.some((account) => account.name === manualBankName) && !manualBankAccountId) {
      const matched = accountsForKind.find((account) => account.name === manualBankName) ?? null;
      if (matched) {
        setManualBankAccountId(matched.id);
      }
    }
  }, [activeKind, accountsForKind, manualBankName, manualBankAccountId]);

  useEffect(() => {
    if (!isManualSecurities) {
      return;
    }
    if (manualSecuritiesName.trim().length === 0) {
      const firstAccount = manualSecuritiesAccounts[0] ?? null;
      if (firstAccount) {
        setManualSecuritiesAccountId(firstAccount.id);
        setManualSecuritiesName(firstAccount.name);
        setManualSecuritiesAmount("");
        setManualSecuritiesProfitAmount("");
        setManualSecuritiesProfitRate("");
        setManualSecuritiesPrimaryField(null);
      } else {
        setManualSecuritiesAccountId(null);
        setManualSecuritiesName("");
        setManualSecuritiesAmount("");
        setManualSecuritiesProfitAmount("");
        setManualSecuritiesProfitRate("");
        setManualSecuritiesPrimaryField(null);
      }
    } else if (
      manualSecuritiesAccountId == null &&
      manualSecuritiesAccounts.some((account) => account.name === manualSecuritiesName)
    ) {
      const matched =
        manualSecuritiesAccounts.find((account) => account.name === manualSecuritiesName) ?? null;
      if (matched) {
        setManualSecuritiesAccountId(matched.id);
      }
    }
  }, [
    isManualSecurities,
    manualSecuritiesAccounts,
    manualSecuritiesAccountId,
    manualSecuritiesName
  ]);

  useEffect(
    () => () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      syncStartTimeRef.current = null;
    },
    []
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveKind("securities");
  }, [open]);

  useEffect(() => {
    const firstProvider = providerOptions[0]?.value ?? null;
    setSelectedProvider((prev) =>
      prev && providerOptions.some((option) => option.value === prev) ? prev : firstProvider
    );
  }, [providerOptions]);

  useEffect(() => {
    if (accountsForProvider.length === 0) {
      setSelectedAccountId(null);
      return;
    }
    setSelectedAccountId((prev) =>
      prev && accountsForProvider.some((account) => account.id === prev) ? prev : accountsForProvider[0].id
    );
  }, [accountsForProvider]);

  const ensureAccountForProvider = useCallback(
    async (provider: ProviderKey) => {
      const response = await fetch("/api/accounts/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider })
      });

      if (!response.ok) {
        throw new Error(TEXT.errorEnsureAccount);
      }

      const account = (await response.json()) as AccountRecord;

      setAccountRecords((prev) => {
        if (prev.some((item) => item.id === account.id)) {
          return prev.map((item) => (item.id === account.id ? account : item));
        }
        return [...prev, account];
      });

      setSelectedAccountId(account.id);
      return account;
    },
    []
  );

  const clearRetryTimer = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const abortActiveController = useCallback(() => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
      setActiveControllerState(null);
    }
  }, []);

  useEffect(() => {
    if (isManualMode) {
      clearRetryTimer();
      abortActiveController();
      setIsAutoSyncActive(false);
      setStatus(null);
      syncStartTimeRef.current = null;
    }
  }, [abortActiveController, clearRetryTimer, isManualMode]);

  const scheduleSyncAttempt = useCallback(
    (delay: number, attempt: number, execute: (nextAttempt: number) => void) => {
      clearRetryTimer();
      retryTimeoutRef.current = setTimeout(() => {
        execute(attempt);
      }, delay);
    },
    [clearRetryTimer]
  );

  const handleCancel = useCallback(() => {
    if (isManualBank) {
      const firstAccount = accountsForKind[0] ?? null;
      if (firstAccount) {
        setManualBankAccountId(firstAccount.id);
        setManualBankName(firstAccount.name);
      } else {
        setManualBankAccountId(null);
        setManualBankName("");
      }
      setManualBankAmount("");
      setStatus(null);
      return;
    }

    if (isManualSecurities) {
      const firstAccount = manualSecuritiesAccounts[0] ?? null;
      if (firstAccount) {
        setManualSecuritiesAccountId(firstAccount.id);
        setManualSecuritiesName(firstAccount.name);
      } else {
        setManualSecuritiesAccountId(null);
        setManualSecuritiesName("");
      }
      setManualSecuritiesAmount("");
      setManualSecuritiesProfitAmount("");
      setManualSecuritiesProfitRate("");
      setManualSecuritiesPrimaryField(null);
      setStatus(null);
      return;
    }

    clearRetryTimer();
    abortActiveController();
    setIsAutoSyncActive(false);
    setStatus({ state: "error", message: TEXT.statusCancelled });
    syncStartTimeRef.current = null;
  }, [
    abortActiveController,
    accountsForKind,
    clearRetryTimer,
    isManualBank,
    isManualSecurities,
    manualSecuritiesAccounts
  ]);

  useEffect(
    () => () => {
      clearRetryTimer();
      abortActiveController();
      syncStartTimeRef.current = null;
    },
    [abortActiveController, clearRetryTimer]
  );

  const runSyncAttempt = useCallback(
    (attempt: number) => {
      if (!selectedProvider || !selectedAccountId) {
        setStatus({ state: "error", message: TEXT.errorNoAccount });
        setIsAutoSyncActive(false);
        syncStartTimeRef.current = null;
        return;
      }

      const startTime = syncStartTimeRef.current ?? Date.now();
      syncStartTimeRef.current = startTime;
      if (Date.now() - startTime >= MAX_AUTO_SYNC_DURATION) {
        setStatus({ state: "error", message: TEXT.statusTimeout });
        setIsAutoSyncActive(false);
        syncStartTimeRef.current = null;
        return;
      }

      abortActiveController();
      const controller = new AbortController();
      setActiveController(controller);

      setStatus({
        state: "progress",
        message: formatStatusRetry(attempt)
      });

      startTransition(async () => {
        try {
          const response = await fetch("/api/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connector: selectedProvider,
              accountId: selectedAccountId
            }),
            signal: controller.signal
          });

          let data: any = null;
          try {
            data = await response.json();
          } catch {
            // ignore parse errors
          }

          const logs = Array.isArray(data?.logs) ? data.logs : [];

          if (!response.ok) {
            if (controller.signal.aborted) {
              return;
            }
            const start = syncStartTimeRef.current;
            if (start != null && Date.now() - start >= MAX_AUTO_SYNC_DURATION) {
              setStatus({ state: "error", message: TEXT.statusTimeout });
              setActiveController(null);
              setIsAutoSyncActive(false);
              clearRetryTimer();
              syncStartTimeRef.current = null;
              return;
            }
            const nextAttempt = attempt + 1;
            const nextDelay = Math.min(RETRY_DELAY_BASE * attempt, RETRY_DELAY_MAX);
            const message =
              typeof data?.message === "string"
                ? `${data.message} / ${formatStatusRetry(nextAttempt)}`
                : formatStatusRetry(nextAttempt);
            setStatus({
              state: "progress",
              message,
              logs
            });
            setActiveController(null);
            scheduleSyncAttempt(nextDelay, nextAttempt, runSyncAttempt);
            return;
          }

          if (controller.signal.aborted) {
            return;
          }

          setStatus({
            state: "success",
            message: TEXT.statusSuccess,
            logs
          });
          clearRetryTimer();
          setActiveController(null);
          setIsAutoSyncActive(false);
          syncStartTimeRef.current = null;
          router.refresh();
          onSyncComplete?.();
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          const start = syncStartTimeRef.current;
          if (start != null && Date.now() - start >= MAX_AUTO_SYNC_DURATION) {
            setStatus({ state: "error", message: TEXT.statusTimeout });
            setActiveController(null);
            setIsAutoSyncActive(false);
            clearRetryTimer();
            syncStartTimeRef.current = null;
            return;
          }
          const nextAttempt = attempt + 1;
          const nextDelay = Math.min(RETRY_DELAY_BASE * attempt, RETRY_DELAY_MAX);
          const message =
            error instanceof Error
              ? `${error.message} / ${formatStatusRetry(nextAttempt)}`
              : formatStatusRetry(nextAttempt);
          setStatus({
            state: "progress",
            message,
            logs: []
          });
          setActiveController(null);
          scheduleSyncAttempt(nextDelay, nextAttempt, runSyncAttempt);
        }
      });
    },
    [
      abortActiveController,
      clearRetryTimer,
      onSyncComplete,
      router,
      scheduleSyncAttempt,
      selectedAccountId,
      selectedProvider,
      setActiveController,
      startTransition
    ]
  );

  const handleClose = useCallback(() => {
    if (isPending) return;
    handleCancel();
    onOpenChange(false);
  }, [handleCancel, isPending, onOpenChange]);

  const handleSync = useCallback(async () => {
    if (isManualMode) {
      const nameInput = isManualBank ? manualBankName : manualSecuritiesName;
      const amountInput = isManualBank ? manualBankAmount : manualSecuritiesAmount;
      const manualAccountId = isManualBank ? manualBankAccountId : manualSecuritiesAccountId;
      const trimmedName = nameInput.trim();
      if (!trimmedName) {
        setStatus({ state: "error", message: TEXT.errorManualNoName });
        return;
      }

      const sanitizedAmount = sanitizeNumericInput(amountInput);
      if (sanitizedAmount.length === 0) {
        setStatus({ state: "error", message: TEXT.errorManualInvalidAmount });
        return;
      }

      const amountValueRaw = parseNumericInput(sanitizedAmount);
      if (amountValueRaw == null || amountValueRaw < 0) {
        setStatus({ state: "error", message: TEXT.errorManualInvalidAmount });
        return;
      }
      const amountValue = Math.round(amountValueRaw * 100) / 100;

      let profitAmountValue: number | null = null;
      let profitRateValue: number | null = null;

      if (isManualSecurities) {
        const profitAmountRaw = parseNumericInput(manualSecuritiesProfitAmount);
        const profitRateRaw = parseNumericInput(manualSecuritiesProfitRate);

        if (profitAmountRaw != null) {
          const candidateCost = amountValue - profitAmountRaw;
          if (candidateCost < 0) {
            setStatus({ state: "error", message: TEXT.statusManualInvestmentError });
            return;
          }
          profitAmountValue = Math.round(profitAmountRaw * 100) / 100;
          if (candidateCost > 0) {
            const rate = (profitAmountRaw / candidateCost) * 100;
            profitRateValue = Math.round(rate * 100) / 100;
          }
        } else if (profitRateRaw != null) {
          const denominator = 1 + profitRateRaw / 100;
          if (denominator <= 0) {
            setStatus({ state: "error", message: TEXT.statusManualInvestmentError });
            return;
          }
          const computedProfit = amountValue - amountValue / denominator;
          profitAmountValue = Math.round(computedProfit * 100) / 100;
          profitRateValue = Math.round(profitRateRaw * 100) / 100;
        }
      }

      setStatus({
        state: "progress",
        message: isManualBank ? TEXT.statusManualSubmitting : TEXT.statusManualInvestmentSubmitting
      });
      startTransition(async () => {
        try {
          const payload: Record<string, unknown> = {
            accountId: manualAccountId ?? undefined,
            name: trimmedName,
            amount: amountValue,
            kind: isManualBank ? "bank" : "securities"
          };

          if (isManualSecurities) {
            if (profitAmountValue != null) {
              payload.profitAmount = profitAmountValue;
            }
            if (profitRateValue != null) {
              payload.profitRate = profitRateValue;
            }
          }

          const response = await fetch("/api/manual-snapshots", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            let message = isManualBank ? TEXT.statusManualError : TEXT.statusManualInvestmentError;
            try {
              const errorBody = await response.json();
              if (typeof errorBody?.message === "string" && errorBody.message.length > 0) {
                message = errorBody.message;
              }
            } catch {
              // ignore json parse errors
            }
            setStatus({ state: "error", message });
            return;
          }

          const data = (await response.json()) as { ok: boolean; account?: AccountRecord };
          if (!data.ok || !data.account) {
            setStatus({
              state: "error",
              message: isManualBank ? TEXT.statusManualError : TEXT.statusManualInvestmentError
            });
            return;
          }

          setAccountRecords((prev) => {
            const updated = data.account!;
            if (prev.some((item) => item.id === updated.id)) {
              return prev.map((item) => (item.id === updated.id ? updated : item));
            }
            return [...prev, updated];
          });

          if (isManualBank) {
            setManualBankAccountId(data.account.id);
            setManualBankName(data.account.name);
            setManualBankAmount("");
          } else {
            setManualSecuritiesAccountId(data.account.id);
            setManualSecuritiesName(data.account.name);
            setManualSecuritiesAmount("");
            setManualSecuritiesProfitAmount("");
            setManualSecuritiesProfitRate("");
            setManualSecuritiesPrimaryField(null);
          }
          setStatus({
            state: "success",
            message: isManualBank ? TEXT.statusManualSuccess : TEXT.statusManualInvestmentSuccess
          });
          router.refresh();
        } catch (error) {
          setStatus({
            state: "error",
            message:
              error instanceof Error
                ? error.message
                : isManualBank
                ? TEXT.statusManualError
                : TEXT.statusManualInvestmentError
          });
        }
      });
      return;
    }

    if (!selectedProvider) {
      setStatus({ state: "error", message: TEXT.errorNoKind });
      return;
    }

    let accountId = selectedAccountId;
    if (!accountId) {
      try {
        const account = await ensureAccountForProvider(selectedProvider);
        accountId = account.id;
      } catch (error) {
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : TEXT.errorEnsureAccount
        });
        return;
      }
    }

    if (!accountId) {
      setStatus({ state: "error", message: TEXT.errorNoAccount });
      return;
    }

    clearRetryTimer();
    abortActiveController();
    setIsAutoSyncActive(true);
    setStatus({ state: "progress", message: TEXT.statusAwaitLogin });
    syncStartTimeRef.current = Date.now();

    scheduleSyncAttempt(1000, 1, runSyncAttempt);
  }, [
    abortActiveController,
    clearRetryTimer,
    ensureAccountForProvider,
    isManualBank,
    isManualMode,
    isManualSecurities,
    manualBankAccountId,
    manualBankAmount,
    manualBankName,
    manualSecuritiesAccountId,
    manualSecuritiesAmount,
    manualSecuritiesName,
    router,
    runSyncAttempt,
    scheduleSyncAttempt,
    selectedAccountId,
    selectedProvider,
    setAccountRecords,
    setStatus,
    startTransition
  ]);

  if (!open) {
    return null;
  }

  const selectedProviderLabel =
    selectedProvider != null ? PROVIDER_CONFIG[selectedProvider]?.label ?? selectedProvider : "";

  const logs = status && "logs" in status && Array.isArray(status.logs) ? status.logs : [];
  const currentAccount = accountsForProvider[0] ?? null;
  const lastSyncedLabel = formatSyncedLabel(currentAccount?.lastSyncedAt ?? null);
  const manualSelectedAccount =
    isManualBank
      ? manualBankAccountId
        ? accountsForKind.find((account) => account.id === manualBankAccountId) ?? null
        : accountsForKind.find((account) => account.name === manualBankName) ?? null
      : isManualSecurities
      ? manualSecuritiesAccountId
        ? accountsForProvider.find((account) => account.id === manualSecuritiesAccountId) ?? null
        : accountsForProvider.find((account) => account.name === manualSecuritiesName) ?? null
      : null;
  const manualLastSyncedLabel = isManualMode
    ? formatSyncedLabel(manualSelectedAccount?.lastSyncedAt ?? null)
    : null;
  const statusMessage =
    status?.message ??
    (isManualBank
      ? TEXT.statusManualIdle
      : isManualSecurities
      ? TEXT.statusManualInvestmentIdle
      : TEXT.statusIdle);
  const providerWorkflowHint =
    !isManualMode && selectedProvider === "rakuten"
      ? TEXT.workflowHintRakuten
      : !isManualMode && selectedProvider === "sbi-securities"
      ? TEXT.workflowHintSbi
      : null;
  const statusTextClass = cn(
    status?.state === "success"
      ? "text-positive"
      : status?.state === "error"
      ? "text-negative"
      : "text-muted-foreground"
  );
  const isCancelDisabled = isManualMode ? false : !isAutoSyncActive && !activeController;
  const manualInputEmpty =
    isManualBank
      ? manualBankName.trim().length === 0 || manualBankAmount.trim().length === 0
      : isManualSecurities
      ? manualSecuritiesName.trim().length === 0 || manualSecuritiesAmount.trim().length === 0
      : false;
  const isSyncDisabled =
    isPending ||
    (isManualMode ? manualInputEmpty : !selectedProvider || isAutoSyncActive);
  const primaryButtonLabel = isManualMode
    ? isPending
      ? TEXT.snapshotSaving
      : TEXT.snapshotButton
    : isPending || isAutoSyncActive
    ? TEXT.syncing
    : TEXT.syncButton;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 flex w-full max-w-5xl flex-col gap-6 rounded-3xl bg-card p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{TEXT.dialogTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isManualBank
                ? TEXT.manualDialogDescription
                : isManualSecurities
                ? TEXT.manualInvestmentDialogDescription
                : TEXT.dialogDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
            aria-label={TEXT.closeDialog}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="space-y-6">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              {[
                { key: "securities" as ProviderKind, label: TEXT.securitiesTab },
                { key: "bank" as ProviderKind, label: TEXT.bankTab }
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveKind(option.key)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition",
                    activeKind === option.key ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                {activeKind === "bank" ? TEXT.manualAccountListTitle : TEXT.providerListTitle}
              </p>
              <div className="mt-2 space-y-2">
                {activeKind === "bank"
                  ? accountsForKind.length > 0
                    ? accountsForKind.map((account) => {
                        const isActive =
                          manualBankAccountId === account.id || account.name === manualBankName;
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => {
                              setManualBankAccountId(account.id);
                              setManualBankName(account.name);
                              setManualBankAmount("");
                            }}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                              isActive
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                          >
                            {account.name}
                          </button>
                        );
                      })
                    : (
                      <p className="text-xs text-muted-foreground">{TEXT.manualAccountEmpty}</p>
                    )
                  : providerOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedProvider(option.value)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                          selectedProvider === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
              </div>
              {isManualSecurities ? (
                <>
                  <p className="mt-6 text-xs font-semibold text-muted-foreground">
                    {TEXT.manualInvestmentAccountListTitle}
                  </p>
                  <div className="mt-2 space-y-2">
                    {manualSecuritiesAccounts.length > 0 ? (
                      manualSecuritiesAccounts.map((account) => {
                        const isActive =
                          manualSecuritiesAccountId === account.id ||
                          account.name === manualSecuritiesName;
                        return (
                          <button
                            key={account.id}
                            type="button"
                          onClick={() => {
                            setManualSecuritiesAccountId(account.id);
                            setManualSecuritiesName(account.name);
                            setManualSecuritiesAmount("");
                            setManualSecuritiesProfitAmount("");
                            setManualSecuritiesProfitRate("");
                            setManualSecuritiesPrimaryField(null);
                          }}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                              isActive
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                            )}
                          >
                            {account.name}
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground">{TEXT.manualAccountEmpty}</p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </aside>

          {isManualBank ? (
            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{TEXT.selectedAccount}</p>
                    <p className="text-lg font-semibold text-foreground">
                      {manualBankName.trim().length > 0 ? manualBankName : TEXT.notSelected}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {TEXT.lastSynced}: {manualLastSyncedLabel ?? TEXT.notSynced}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-xs font-semibold text-muted-foreground">{TEXT.manualSnapshotTitle}</p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-bank-name">
                    {TEXT.manualNameLabel}
                  </label>
                  <input
                    id="manual-bank-name"
                    type="text"
                    value={manualBankName}
                    onChange={(event) => {
                      const value = event.target.value;
                      setManualBankName(value);
                      const matched = accountsForKind.find((account) => account.name === value);
                      setManualBankAccountId(matched?.id ?? null);
                    }}
                    placeholder={TEXT.manualNamePlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-bank-amount">
                    {TEXT.manualAmountLabel}
                  </label>
                  <input
                    id="manual-bank-amount"
                    type="text"
                    inputMode="numeric"
                    value={manualBankAmount}
                    onChange={(event) => {
                      const value = sanitizeNumericInput(event.target.value);
                      setManualBankAmount(value);
                    }}
                    placeholder={TEXT.manualAmountPlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[200px] flex-1 text-sm">
                  <p className={statusTextClass}>{statusMessage}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Button variant="outline" onClick={handleCancel} disabled={isCancelDisabled}>
                    {TEXT.cancelButton}
                  </Button>
                  <Button onClick={handleSync} disabled={isSyncDisabled} className="px-6">
                    {primaryButtonLabel}
                  </Button>
                </div>
              </div>
            </section>
          ) : isManualSecurities ? (
            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{TEXT.selectedAccount}</p>
                    <p className="text-lg font-semibold text-foreground">
                      {manualSecuritiesName.trim().length > 0 ? manualSecuritiesName : TEXT.notSelected}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {TEXT.lastSynced}: {manualLastSyncedLabel ?? TEXT.notSynced}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-xs font-semibold text-muted-foreground">{TEXT.manualInvestmentSnapshotTitle}</p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-securities-name">
                    {TEXT.manualNameLabel}
                  </label>
                  <input
                    id="manual-securities-name"
                    type="text"
                    value={manualSecuritiesName}
                    onChange={(event) => {
                      const value = event.target.value;
                      setManualSecuritiesName(value);
                      const matched = manualSecuritiesAccounts.find((account) => account.name === value);
                      setManualSecuritiesAccountId(matched?.id ?? null);
                    }}
                    placeholder={TEXT.manualInvestmentNamePlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-securities-amount">
                    {TEXT.manualInvestmentAmountLabel}
                  </label>
                  <input
                    id="manual-securities-amount"
                    type="text"
                    inputMode="numeric"
                    value={manualSecuritiesAmount}
                    onChange={(event) => {
                      const value = sanitizeNumericInput(event.target.value);
                      setManualSecuritiesAmount(value);
                      const evaluationValue = parseNumericInput(value);
                      const effectivePrimary =
                        manualSecuritiesPrimaryField ??
                        (manualSecuritiesProfitAmount.trim().length > 0
                          ? "amount"
                          : manualSecuritiesProfitRate.trim().length > 0
                          ? "rate"
                          : null);

                      if (!effectivePrimary) {
                        if (value.trim().length === 0) {
                          setManualSecuritiesProfitAmount("");
                          setManualSecuritiesProfitRate("");
                        }
                        return;
                      }

                      if (effectivePrimary === "amount") {
                        const profitAmountValue = parseNumericInput(manualSecuritiesProfitAmount);
                        const derivedRate = computeRateFromAmount(evaluationValue, profitAmountValue);
                        setManualSecuritiesProfitRate(derivedRate);
                      } else if (effectivePrimary === "rate") {
                        const profitRateValue = parseNumericInput(manualSecuritiesProfitRate);
                        const derivedAmount = computeAmountFromRate(evaluationValue, profitRateValue);
                        setManualSecuritiesProfitAmount(derivedAmount);
                      }
                    }}
                    placeholder={TEXT.manualInvestmentAmountPlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-securities-profit-amount">
                    {TEXT.manualInvestmentProfitLabel}
                  </label>
                  <input
                    id="manual-securities-profit-amount"
                    type="text"
                    inputMode="numeric"
                    value={manualSecuritiesProfitAmount}
                    onChange={(event) => {
                      const value = sanitizeNumericInput(event.target.value);
                      setManualSecuritiesProfitAmount(value);
                      if (value.trim().length === 0) {
                        setManualSecuritiesPrimaryField(null);
                        setManualSecuritiesProfitRate("");
                        return;
                      }
                      setManualSecuritiesPrimaryField("amount");
                      const evaluationValue = parseNumericInput(manualSecuritiesAmount);
                      const profitAmountValue = parseNumericInput(value);
                      const derivedRate = computeRateFromAmount(evaluationValue, profitAmountValue);
                      setManualSecuritiesProfitRate(derivedRate);
                    }}
                    placeholder={TEXT.manualInvestmentProfitPlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground" htmlFor="manual-securities-profit-rate">
                    {TEXT.manualInvestmentProfitRateLabel}
                  </label>
                  <input
                    id="manual-securities-profit-rate"
                    type="text"
                    inputMode="decimal"
                    value={manualSecuritiesProfitRate}
                    onChange={(event) => {
                      const value = sanitizeNumericInput(event.target.value);
                      setManualSecuritiesProfitRate(value);
                      if (value.trim().length === 0) {
                        setManualSecuritiesPrimaryField(null);
                        if (manualSecuritiesPrimaryField !== "amount") {
                          setManualSecuritiesProfitAmount("");
                        }
                        return;
                      }
                      setManualSecuritiesPrimaryField("rate");
                      const evaluationValue = parseNumericInput(manualSecuritiesAmount);
                      const profitRateValue = parseNumericInput(value);
                      const derivedAmount = computeAmountFromRate(evaluationValue, profitRateValue);
                      setManualSecuritiesProfitAmount(derivedAmount);
                    }}
                    placeholder={TEXT.manualInvestmentProfitRatePlaceholder}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[200px] flex-1 text-sm">
                  <p className={statusTextClass}>{statusMessage}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Button variant="outline" onClick={handleCancel} disabled={isCancelDisabled}>
                    {TEXT.cancelButton}
                  </Button>
                  <Button onClick={handleSync} disabled={isSyncDisabled} className="px-6">
                    {primaryButtonLabel}
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="rounded-2xl border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{TEXT.selectedAccount}</p>
                    <p className="text-lg font-semibold text-foreground">
                      {selectedProviderLabel || TEXT.notSelected}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {TEXT.lastSynced}: {lastSyncedLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
                <p className="text-xs font-semibold text-muted-foreground">{TEXT.workflowTitle}</p>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>{TEXT.workflowStep1}</li>
                  <li>{TEXT.workflowStep2}</li>
                  <li>{TEXT.workflowStep3}</li>
                </ol>
                {providerWorkflowHint ? (
                  <p className="mt-3 text-xs text-muted-foreground">{providerWorkflowHint}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-[200px] flex-1 text-sm">
                  <p className={statusTextClass}>{statusMessage}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Button variant="outline" onClick={handleCancel} disabled={isCancelDisabled}>
                    {TEXT.cancelButton}
                  </Button>
                  <Button onClick={handleSync} disabled={isSyncDisabled} className="px-6">
                    {primaryButtonLabel}
                  </Button>
                </div>
              </div>

              {logs.length > 0 ? (
                <div className="rounded-xl border border-border bg-card/60 p-4">
                  <p className="text-xs font-semibold text-muted-foreground">{TEXT.statusLogsTitle}</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {logs.map((log, index) => (
                      <li key={`${log}-${index}`} className="font-mono">
                        {log}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}






