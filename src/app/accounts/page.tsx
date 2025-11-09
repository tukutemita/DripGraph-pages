import { prisma } from "@/lib/db";
import { ensureDatabaseConsistency } from "@/lib/server/ensureDatabaseConsistency";
import AccountManager from "./AccountManager";

export default async function AccountsPage() {
  await ensureDatabaseConsistency();
  const accounts = await prisma.account.findMany({
    include: { holdings: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">口座管理</h1>
        <p className="text-sm text-neutral-400">
          口座を追加してモックコネクタで同期できる簡易デモです。
        </p>
      </div>
      <AccountManager initialAccounts={accounts} />
    </div>
  );
}
