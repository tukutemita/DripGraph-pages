import puppeteer from "puppeteer";
import { z } from "zod";
import { getProvider, scrapeProviderHoldings } from "./scrape";
import type { Connector } from "./types";

const paramsSchema = z.object({
  mode: z.literal("manual").optional()
});

const provider = getProvider("rakuten");

const launchBrowser = async () => {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  return puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"],
    executablePath: executablePath && executablePath.length > 0 ? executablePath : undefined
  });
};

export const rakutenConnector: Connector = {
  name: "rakuten",
  async sync(rawParams) {
    const params = paramsSchema.parse(rawParams ?? {});

    const logs: string[] = ["launching chromium for rakuten securities"];
    if (params.mode && params.mode !== "manual") {
      logs.push(`unsupported mode "${params.mode}" requested; defaulting to manual flow`);
    }

    const browser = await launchBrowser();

    try {
      const page = await browser.newPage();
      const { holdings, linkedAccounts } = await scrapeProviderHoldings(page, provider, logs);
      const result: { holdings: typeof holdings; logs: string[]; linkedAccounts?: typeof linkedAccounts } = {
        holdings,
        logs
      };
      if (linkedAccounts.length > 0) {
        result.linkedAccounts = linkedAccounts;
      }
      return result;
    } finally {
      await browser.close();
    }
  }
};
