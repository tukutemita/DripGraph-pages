"use client";

import { useCallback, useState, useTransition } from "react";
import type { Account, Holding } from "@prisma/client";

type AccountWithHoldings = Account & { holdings: Holding[] };

type Props = {
  initialAccounts: AccountWithHoldings[];
};

const defaultForm = {
  name: "",
  provider: "",
  method: "session",
  currency: "JPY"
};

export default function AccountManager({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setMessage(null);
      startTransition(async () => {
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!response.ok) {
          setMessage("登録に失敗しました");
          return;
        }
        const created: Account = await response.json();
        setAccounts((prev) => [{ ...created, holdings: [] }, ...prev]);
        setForm(defaultForm);
        setMessage("登録しました");
      });
    },
    [form]
  );

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="text-lg font-semibold">口座を追加</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-neutral-400">口座名</span>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-neutral-100"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-neutral-400">取得方式</span>
            <select
              name="method"
              value={form.method}
              onChange={handleChange}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-neutral-100"
            >
              <option value="session">セッション</option>
              <option value="scrape">スクレイピング</option>
              <option value="api">API</option>
            </select>
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-neutral-400">提供元</span>
            <input
              name="provider"
              value={form.provider}
              onChange={handleChange}
              placeholder="例: rakuten"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-neutral-100"
            />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-neutral-400">口座通貨</span>
            <input
              name="currency"
              value={form.currency}
              onChange={handleChange}
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 p-2 text-neutral-100"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:bg-neutral-700"
        >
          追加する
        </button>
      </form>

      {message && <div className="text-sm text-blue-400">{message}</div>}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">登録済み口座</h2>
        {accounts.length === 0 && <div className="text-sm text-neutral-500">登録された口座はありません。</div>}
        {accounts.map((account) => (
          <div key={account.id} className="space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{account.name}</div>
                <div className="text-xs text-neutral-500">
                  {(account.provider && account.provider.length > 0 ? account.provider : "未設定") +
                    ` / ${account.method} / ${account.currency}`}
                </div>
              </div>
            </div>
            {account.holdings.length > 0 ? (
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="py-1">銘柄</th>
                    <th className="py-1">数量</th>
                    <th className="py-1">評価額</th>
                    <th className="py-1">通貨</th>
                  </tr>
                </thead>
                <tbody>
                  {account.holdings.map((holding) => (
                    <tr key={holding.id} className="border-t border-neutral-800">
                      <td className="py-1">{holding.name}</td>
                      <td className="py-1">{holding.quantity.toLocaleString()}</td>
                      <td className="py-1">{holding.marketValue.toLocaleString()}</td>
                      <td className="py-1">{holding.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-xs text-neutral-500">保有資産はまだ登録されていません。</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
