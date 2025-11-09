"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark";

const applyThemeToDocument = (theme: ThemeOption) => {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.dataset.theme = theme;
};

export default function SettingsPanel() {
  const [passphrase, setPassphrase] = useState("");
  const [stored, setStored] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeOption>("light");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("app-theme") as ThemeOption | null) ??
      (document.documentElement.classList.contains("dark") ? "dark" : "light");
    setTheme(savedTheme);
    applyThemeToDocument(savedTheme);
  }, []);

  const handleThemeChange = useCallback((next: ThemeOption) => {
    setTheme(next);
    localStorage.setItem("app-theme", next);
    applyThemeToDocument(next);
  }, []);

  const themeOptions = useMemo<ThemeOption[]>(() => ["light", "dark"], []);

  const handleSavePassphrase = useCallback(() => {
    if (!passphrase) {
      setMessage("パスフレーズを入力してください");
      return;
    }
    localStorage.setItem("asset-passphrase", passphrase);
    setStored(passphrase);
    setMessage("パスフレーズを保存しました（ブラウザのローカルストレージに保存されます）");
  }, [passphrase]);

  const handleLoadPassphrase = useCallback(() => {
    const value = localStorage.getItem("asset-passphrase");
    setStored(value);
    setMessage(value ? "保存済みのパスフレーズを読み込みました" : "保存済みのパスフレーズはありません");
  }, []);

  const handleClearPassphrase = useCallback(() => {
    localStorage.removeItem("asset-passphrase");
    setStored(null);
    setPassphrase("");
    setMessage("保存済みのパスフレーズを削除しました");
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">テーマ</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          ダッシュボードの背景色をライト / ダークから選択できます。
        </p>
        <div className="mt-4 flex items-center gap-3">
          {themeOptions.map((option) => (
            <Button
              key={option}
              variant={theme === option ? "default" : "outline"}
              onClick={() => handleThemeChange(option)}
              className={cn("px-5", theme === option ? "shadow" : "")}
            >
              {option === "light" ? "ライト" : "ダーク"}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">パスフレーズの管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          連携で使用するパスフレーズをブラウザに保存できます。セキュリティのため共有端末では利用しないでください。
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-muted-foreground" htmlFor="passphrase">
            パスフレーズ
          </label>
          <input
            id="passphrase"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="パスフレーズを入力"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={handleSavePassphrase} className="px-5">
              保存
            </Button>
            <Button variant="outline" onClick={handleLoadPassphrase} className="px-5">
              読み込み
            </Button>
            <Button variant="ghost" onClick={handleClearPassphrase} className="px-5 text-sm text-muted-foreground">
              削除
            </Button>
          </div>
          {stored && (
            <p className="text-xs text-muted-foreground">
              保存済み: {stored.replace(/./g, "•")}
            </p>
          )}
        </div>
        {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
      </section>
    </div>
  );
}
