import type { ProviderKey } from "@/config/providers";

export type ConnectableAccount = {
  id: string;
  name: string;
  provider: ProviderKey;
  method: string;
  lastSyncedAt: string | null;
};
