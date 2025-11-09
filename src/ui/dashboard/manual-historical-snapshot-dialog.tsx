"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { cn } from "@/lib/utils";
import { PROVIDER_CONFIG } from "@/config/providers";
import { parseNumericInput, sanitizeNumericInput } from "./numeric-input";
import type { ConnectableAccount } from "./types";

const TEXT = {
  dialogTitle: "過去資産を手入力",
  dialogDescription: "年月と資産額を入力し、選択した口座のスナップショットに追加します。",
  accountLabel: "対象口座",
  monthLabel: "年月",
  amountLabel: "資産額 (円)",
  assetKindLabel: "ジャンル",
  assetKindDescription: "このスナップショットを運用資産か現金資産のどちらとして扱うか選択してください。",
  assetKindInvestment: "運用資産",
  assetKindInvestmentDescription: "株式・投資信託などのリスク資産として集計します。",
  assetKindCash: "現金資産",
  assetKindCashDescription: "普通預金や現金などの安全資産として集計します。",
  placeholderAmount: "例: 1250000",
  cancel: "キャンセル",
  submit: "スナップショットを追加",
  statusIdle: "年月と資産額を入力してください。",
  statusSaving: "スナップショットを保存しています…",
  statusSuccess: "スナップショットを保存しました。",
  errorNoAccount: "対象口座を選択してください。",
  errorNoMonth: "年月を選択してください。",
  errorAmount: "資産額に数値を入力してください。"
} as const;

const ASSET_KIND_OPTIONS = ["investment", "cash"] as const;
type AssetKind = (typeof ASSET_KIND_OPTIONS)[number];

const CASH_ACCOUNT_METHODS = new Set(["manual-snapshot", "manual-scrape"]);

const resolveAssetKindFromAccount = (account: ConnectableAccount | null): AssetKind => {
  if (!account) {
    return "investment";
  }
  const providerConfig = PROVIDER_CONFIG[account.provider];
  if (providerConfig?.kind === "bank") {
    return "cash";
  }
  if (CASH_ACCOUNT_METHODS.has(account.method)) {
    return "cash";
  }
  return "investment";
};

const ASSET_KIND_CHOICES = [
  {
    value: "investment",
    label: TEXT.assetKindInvestment,
    description: TEXT.assetKindInvestmentDescription
  },
  {
    value: "cash",
    label: TEXT.assetKindCash,
    description: TEXT.assetKindCashDescription
  }
] as const satisfies Array<{
  value: AssetKind;
  label: string;
  description: string;
}>;

type StatusState =
  | { state: "idle"; message: string }
  | { state: "success"; message: string }
  | { state: "error"; message: string };

type ManualHistoricalSnapshotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: ConnectableAccount[];
};

export function ManualHistoricalSnapshotDialog(props: ManualHistoricalSnapshotDialogProps) {
  const { open, onOpenChange, accounts } = props;
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [assetKind, setAssetKind] = useState<AssetKind>(() =>
    resolveAssetKindFromAccount(accounts[0] ?? null)
  );
  const [status, setStatus] = useState<StatusState>({ state: "idle", message: TEXT.statusIdle });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccountId("");
      setAssetKind("investment");
      return;
    }
    if (!selectedAccountId || !accounts.some((account) => account.id === selectedAccountId)) {
      const nextAccount = accounts[0]!;
      setSelectedAccountId(nextAccount.id);
      setAssetKind(resolveAssetKindFromAccount(nextAccount));
    }
  }, [accounts, selectedAccountId]);

  useEffect(() => {
    if (!open) {
      setSelectedMonth("");
      setAmountInput("");
      setStatus({ state: "idle", message: TEXT.statusIdle });
      const fallbackAccount =
        accounts.find((account) => account.id === selectedAccountId) ?? accounts[0] ?? null;
      setAssetKind(resolveAssetKindFromAccount(fallbackAccount));
    }
  }, [open, accounts, selectedAccountId]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  );

  const handleClose = () => {
    if (isPending) return;
    onOpenChange(false);
  };

  const handleAccountChange = (value: string) => {
    if (!value) {
      setSelectedAccountId("");
      setAssetKind("investment");
      return;
    }
    setSelectedAccountId(value);
    const nextAccount = accounts.find((account) => account.id === value) ?? null;
    setAssetKind(resolveAssetKindFromAccount(nextAccount));
  };

  const handleAmountChange = (value: string) => {
    setAmountInput(sanitizeNumericInput(value));
  };

  const handleSubmit = () => {
    if (!selectedAccountId) {
      setStatus({ state: "error", message: TEXT.errorNoAccount });
      return;
    }
    if (!selectedMonth) {
      setStatus({ state: "error", message: TEXT.errorNoMonth });
      return;
    }
    const parsedAmount = parseNumericInput(amountInput);
    if (parsedAmount == null || parsedAmount < 0) {
      setStatus({ state: "error", message: TEXT.errorAmount });
      return;
    }

    setStatus({ state: "idle", message: TEXT.statusSaving });
    startTransition(async () => {
      try {
        const response = await fetch("/api/historical-snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: selectedAccountId,
            period: selectedMonth,
            amount: parsedAmount,
            assetKind
          })
        });

        if (!response.ok) {
          let errorMessage = TEXT.errorAmount;
          try {
            const body = await response.json();
            if (typeof body?.error === "string" && body.error.length > 0) {
              errorMessage = body.error;
            }
          } catch {
            // ignore json parse errors
          }
          setStatus({ state: "error", message: errorMessage });
          return;
        }

        setAmountInput("");
        setSelectedMonth("");
        setStatus({ state: "success", message: TEXT.statusSuccess });
        router.refresh();
      } catch (error) {
        setStatus({
          state: "error",
          message: error instanceof Error ? error.message : TEXT.errorAmount
        });
      }
    });
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{TEXT.dialogTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{TEXT.dialogDescription}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted"
            aria-label="ダイアログを閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{TEXT.accountLabel}</span>
            <select
              className={cn(
                "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                !accounts.length && "opacity-60"
              )}
              value={selectedAccountId}
              onChange={(event) => handleAccountChange(event.target.value)}
              disabled={accounts.length === 0 || isPending}
            >
              {accounts.length === 0 ? (
                <option value="" disabled>
                  口座がありません
                </option>
              ) : null}
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{TEXT.monthLabel}</span>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              disabled={isPending}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{TEXT.amountLabel}</span>
            <Input
              type="text"
              inputMode="numeric"
              value={amountInput}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder={TEXT.placeholderAmount}
              disabled={isPending}
            />
          </label>

          <div className="flex flex-col gap-2 text-sm font-medium">
            <span className="text-muted-foreground">{TEXT.assetKindLabel}</span>
            <span className="text-xs text-muted-foreground">{TEXT.assetKindDescription}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              {ASSET_KIND_CHOICES.map((choice) => {
                const isActive = assetKind === choice.value;
                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setAssetKind(choice.value)}
                    disabled={isPending}
                    className={cn(
                      "h-full rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40"
                    )}
                    aria-pressed={isActive}
                  >
                    <span className="text-sm font-semibold">{choice.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{choice.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">{selectedAccount?.name ?? "口座未選択"}</p>
              <p className="text-xs text-muted-foreground">
                {status.message}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                {TEXT.cancel}
              </Button>
              <Button onClick={handleSubmit} disabled={isPending || accounts.length === 0}>
                {isPending ? TEXT.statusSaving : TEXT.submit}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
