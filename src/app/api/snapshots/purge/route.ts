import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { SnapshotPurgeCounts } from "@/types/snapshots";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId")?.trim();

    let counts: SnapshotPurgeCounts;

    if (accountId && accountId.length > 0) {
      const existingAccount = await prisma.account.findUnique({
        where: { id: accountId },
        select: { id: true }
      });

      if (!existingAccount) {
        return NextResponse.json({ error: "account not found" }, { status: 404 });
      }

      counts = await prisma.$transaction<SnapshotPurgeCounts>(async (tx) => {
        const holdingSnapshots = await tx.holdingSnapshot.deleteMany({
          where: { accountId }
        });
        const accountSnapshots = await tx.accountSnapshot.deleteMany({
          where: { accountId }
        });

        await tx.account.delete({
          where: { id: accountId }
        });

        return {
          accountSnapshots: accountSnapshots.count,
          holdingSnapshots: holdingSnapshots.count,
          rateSnapshots: 0
        };
      });
    } else {
      counts = await prisma.$transaction<SnapshotPurgeCounts>(async (tx) => {
        const holdingSnapshots = await tx.holdingSnapshot.deleteMany();
        const accountSnapshots = await tx.accountSnapshot.deleteMany();
        const rateSnapshots = await tx.rateSnapshot.deleteMany();

        return {
          accountSnapshots: accountSnapshots.count,
          holdingSnapshots: holdingSnapshots.count,
          rateSnapshots: rateSnapshots.count
        };
      });
    }

    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error("failed to purge snapshots", error);
    return NextResponse.json({ error: "failed to purge snapshots" }, { status: 500 });
  }
}
