import { rakutenConnector } from "./rakuten";
import { rakutenBankConnector } from "./rakutenBank";
import { sbiConnector } from "./sbi";
import type { Connector } from "./types";

export const registry: Record<string, Connector> = {
  rakuten: rakutenConnector,
  "rakuten-bank": rakutenBankConnector,
  "sbi-securities": sbiConnector
};
