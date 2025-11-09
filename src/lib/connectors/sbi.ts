import puppeteer from "puppeteer";
import { z } from "zod";
import { getProvider, scrapeProviderHoldings } from "./scrape";
import type { Connector } from "./types";

const paramsSchema = z.object({
  mode: z.literal("manual").optional()
});

const provider = getProvider("sbi-securities");

const launchBrowser = async () => {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  return puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--window-size=1920,1080"],
    executablePath: executablePath && executablePath.length > 0 ? executablePath : undefined
  });
};

export const sbiConnector: Connector = {
  name: "sbi-securities",
  async sync(rawParams) {
    const params = paramsSchema.parse(rawParams ?? {});

    const logs: string[] = ["launching chromium for sbi securities"];
    if (params.mode && params.mode !== "manual") {
      logs.push(`unsupported mode "${params.mode}" requested; defaulting to manual flow`);
    }

    const browser = await launchBrowser();

    try {
      const page = await browser.newPage();
      const { holdings } = await scrapeProviderHoldings(page, provider, logs);
      return { holdings, logs };
    } finally {
      await browser.close();
    }
  }
};
