import { prisma } from "@/lib/db";

type TableCheck = {
  table: string;
  column: string;
  alterSql: string;
};

const REQUIRED_COLUMNS: TableCheck[] = [
  {
    table: "Holding",
    column: "profitRate",
    alterSql: 'ALTER TABLE "Holding" ADD COLUMN "profitRate" REAL'
  },
  {
    table: "HoldingSnapshot",
    column: "profitRate",
    alterSql: 'ALTER TABLE "HoldingSnapshot" ADD COLUMN "profitRate" REAL'
  }
];

declare global {
  // eslint-disable-next-line no-var
  var __ensureDatabaseConsistencyPromise: Promise<void> | undefined;
}

const hasColumn = async (table: string, column: string) => {
  const rows = await prisma.$queryRawUnsafe<{ name?: string }[]>(
    `PRAGMA table_info("${table}")`
  );
  return rows.some((row) => row?.name === column);
};

const ensureColumn = async ({ table, column, alterSql }: TableCheck) => {
  const exists = await hasColumn(table, column);
  if (!exists) {
    await prisma.$executeRawUnsafe(alterSql);
  }
};

const runConsistencyCheck = async () => {
  for (const requirement of REQUIRED_COLUMNS) {
    await ensureColumn(requirement);
  }
};

export const ensureDatabaseConsistency = async () => {
  if (!globalThis.__ensureDatabaseConsistencyPromise) {
    globalThis.__ensureDatabaseConsistencyPromise = runConsistencyCheck().catch((error) => {
      globalThis.__ensureDatabaseConsistencyPromise = undefined;
      throw error;
    });
  }
  return globalThis.__ensureDatabaseConsistencyPromise;
};
