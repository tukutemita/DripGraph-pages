import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
