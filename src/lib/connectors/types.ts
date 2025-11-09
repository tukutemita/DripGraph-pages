import type { ProviderKey } from "@/config/providers";

export type HoldingPayload = {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice?: number;
  costAmount?: number;
  marketValue: number;
  currency: string;
  profitAmount?: number;
  profitRate?: number;
  group?: string;
};

export type LinkedAccountSnapshot = {
  provider: ProviderKey;
  holdings: HoldingPayload[];
};

export type SyncResult = {
  holdings: HoldingPayload[];
  logs?: string[];
  linkedAccounts?: LinkedAccountSnapshot[];
};

export interface Connector {
  name: string;
  sync: (params: Record<string, unknown>) => Promise<SyncResult>;
}
