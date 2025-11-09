import { type Page } from "puppeteer";
import {
  PROVIDER_CONFIG,
  findProviderCategoryByLabel,
  type ProviderDetails,
  type ProviderKey
} from "@/config/providers";
import type { HoldingPayload } from "./types";

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const MANUAL_TIMEOUT_MS = 10 * 60 * 1000;
const LOGIN_CHECK_INTERVAL_MS = 5_000;

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const slugifyForSymbol = (label: string) => {
  const normalized = label.normalize("NFKC").replace(/[\s\u3000]+/g, "-");
  const ascii = normalized.replace(/[^A-Za-z0-9-]/g, "");
  if (ascii.length > 0) {
    return ascii.toUpperCase();
  }
  return Buffer.from(label, "utf8").toString("hex").slice(0, 24).toUpperCase();
};

const parseAmount = (value: string | null): number => {
  if (!value) {
    return NaN;
  }
  const numeric = value.replace(/[^\d.-]/g, "");
  return Number.parseFloat(numeric);
};

export const getProvider = (key: ProviderKey): ProviderDetails => PROVIDER_CONFIG[key];

type ScrapedLinkedAccount = {
  provider: ProviderKey;
  holdings: HoldingPayload[];
};

type ScrapeResult = {
  holdings: HoldingPayload[];
  linkedAccounts: ScrapedLinkedAccount[];
};

const fallbackFromSnapshot = (
  provider: ProviderDetails,
  totalAmount: number,
  cashAmount: number | null
): HoldingPayload[] => {
  const normalizedCash =
    provider.kind === "bank" && (cashAmount == null || cashAmount <= 0)
      ? totalAmount
      : cashAmount ?? 0;
  const cash = normalizedCash > 0 ? Math.min(normalizedCash, totalAmount) : 0;
  const investmentValue = Math.max(0, totalAmount - cash);
  const result: HoldingPayload[] = [];

  if (investmentValue > 0) {
    result.push({
      symbol: `${provider.holdings.totalSymbol}-INVESTMENT`,
      name: `${provider.label} \u904b\u7528\u8cc7\u7523`,
      quantity: 1,
      costAmount: investmentValue,
      marketValue: investmentValue,
      currency: "JPY",
      profitAmount: undefined,
      group: "\u904b\u7528\u8cc7\u7523"
    });
  }

  if (cash > 0) {
    result.push({
      symbol: `${provider.holdings.totalSymbol}-CASH`,
      name: `${provider.label} \u73fe\u91d1\u8cc7\u7523`,
      quantity: 1,
      costAmount: cash,
      marketValue: cash,
      currency: "JPY",
      profitAmount: undefined,
      group: "\u73fe\u91d1\u8cc7\u7523"
    });
  }

  if (result.length === 0) {
    result.push({
      symbol: provider.holdings.totalSymbol,
      name: provider.holdings.totalLabel,
      quantity: 1,
      costAmount: totalAmount,
      marketValue: totalAmount,
      currency: "JPY",
      profitAmount: undefined,
      group: provider.kind === "bank" ? "\u73fe\u91d1\u8cc7\u7523" : "\u904b\u7528\u8cc7\u7523"
    });
  }

  return result;
};

export const scrapeProviderHoldings = async (
  page: Page,
  provider: ProviderDetails,
  logs: string[]
): Promise<ScrapeResult> => {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  logs.push(`navigating to ${provider.login.url}`);
  await page.goto(provider.login.url, { waitUntil: "domcontentloaded", timeout: LOGIN_TIMEOUT_MS });

  const summaryUrl = provider.login.afterLoginUrl;
  if (!summaryUrl) {
    throw new Error("\u8cc7\u7523\u30b5\u30de\u30ea URL \u304c\u69cb\u6210\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002\u8a2d\u5b9a\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
  }

  logs.push(
    `waiting for manual login completion (checking current URL every ${LOGIN_CHECK_INTERVAL_MS / 1000} seconds)`
  );
  const startedAt = Date.now();

  const summaryPrefix = summaryUrl.split("?")[0];
  const waitUrlPrefixes = new Set<string>([summaryPrefix]);
  const manualWaitUrl = provider.manualDetection?.waitUrlPrefix;
  if (manualWaitUrl) {
    waitUrlPrefixes.add(manualWaitUrl);
  }
  const manualWaitSelector = provider.manualDetection?.waitSelector;
  const manualProbe = provider.manualDetection?.probe;
  let lastProbeTimestamp = 0;

  let loginConfirmed = false;
  let loginConfirmationReason: { type: "url" | "selector" | "probe"; value: string } | null = null;

  while (Date.now() - startedAt <= MANUAL_TIMEOUT_MS) {
    const currentUrl = page.url();
    const matchedPrefix = Array.from(waitUrlPrefixes).find((prefix) => currentUrl.startsWith(prefix));
    if (matchedPrefix) {
      loginConfirmed = true;
      loginConfirmationReason = { type: "url", value: currentUrl };
      break;
    }

    if (manualWaitSelector) {
      try {
        const elementHandle = await page.$(manualWaitSelector);
        if (elementHandle) {
          loginConfirmed = true;
          loginConfirmationReason = { type: "selector", value: manualWaitSelector };
          await elementHandle.dispose();
          break;
        }
      } catch {
        // Ignore transient DOM evaluation errors during manual login checks.
      }
    }

    if (manualProbe && Date.now() - lastProbeTimestamp >= LOGIN_CHECK_INTERVAL_MS) {
      try {
        const probeResult = await page.evaluate(async (probe) => {
          try {
            const response = await fetch(probe.url, {
              method: "GET",
              credentials: "include",
              cache: "no-store"
            });
            return {
              success: response.ok,
              status: response.status,
              redirected: response.redirected,
              finalUrl: response.url
            };
          } catch (error) {
            return {
              success: false,
              status: 0,
              redirected: false,
              finalUrl: "",
              error: error instanceof Error ? error.message : String(error)
            };
          }
        }, manualProbe);

        const finalUrl = probeResult.finalUrl ?? "";
        if (probeResult.success && finalUrl.length > 0) {
          const candidates = new Set(waitUrlPrefixes);
          if (manualProbe.successUrlIncludes) {
            candidates.add(manualProbe.successUrlIncludes);
          }
          const normalizedFinal = finalUrl.split("?")[0];
          const matchedCandidate = Array.from(candidates).find((candidate) => {
            if (candidate.startsWith("http")) {
              return normalizedFinal.startsWith(candidate);
            }
            return finalUrl.includes(candidate);
          });
          if (matchedCandidate) {
            loginConfirmed = true;
            loginConfirmationReason = { type: "probe", value: finalUrl };
            break;
          }
        }

        if (!probeResult.success && probeResult.status > 0 && finalUrl.includes("COMMAND=LOGIN")) {
          logs.push(
            `probe received login redirect (status ${probeResult.status}); awaiting manual authentication`
          );
        }
      } catch (error) {
        logs.push(
          `probe check failed: ${
            error instanceof Error ? error.message : "unknown error during manual login probe"
          }`
        );
      } finally {
        lastProbeTimestamp = Date.now();
      }
    }

    await delay(LOGIN_CHECK_INTERVAL_MS);
  }

  if (!loginConfirmed) {
    throw new Error("\u30ed\u30b0\u30a4\u30f3\u5b8c\u4e86\u3092\u78ba\u8a8d\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u30d6\u30e9\u30a6\u30b6\u3067\u8a8d\u8a3c\u3092\u5b8c\u4e86\u3057\u3066\u304b\u3089\u518d\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
  }

  if (loginConfirmationReason?.type === "selector") {
    logs.push(
      `login confirmed via selector ${loginConfirmationReason.value}; proceeding to asset summary page`
    );
  } else if (loginConfirmationReason?.type === "probe") {
    logs.push(`login confirmed via probe response (${loginConfirmationReason.value})`);
  } else {
    logs.push("login confirmed via URL check; proceeding to asset summary page");
  }

  logs.push(`accessing asset summary at ${summaryUrl}`);
  await page.goto(summaryUrl, { waitUntil: "networkidle2", timeout: LOGIN_TIMEOUT_MS });

  const assetSelector = provider.selectors.assetTotal;
  if (!assetSelector) {
    throw new Error("\u30d7\u30ed\u30d0\u30a4\u30c0\u30fc\u306e\u8cc7\u7523\u30bb\u30ec\u30af\u30bf\u304c\u672a\u8a2d\u5b9a\u3067\u3059\u3002");
  }

  await page.waitForSelector(assetSelector, { timeout: LOGIN_TIMEOUT_MS });
  const { dataEye, text } = await page.$eval(assetSelector, (element) => ({
    dataEye: element.getAttribute("data-eye") ?? "",
    text: element.textContent?.trim() ?? ""
  }));

  const totalAmount = parseAmount(dataEye || text);
  if (!Number.isFinite(totalAmount)) {
    logs.push(`failed to parse asset total amount: data-eye="${dataEye}", text="${text}"`);
    throw new Error("\u8cc7\u7523\u5408\u8a08\u984d\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u753b\u9762\u69cb\u6210\u306e\u5909\u66f4\u304c\u306a\u3044\u304b\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
  }

  let cashAmount: number | null = null;
  if (provider.selectors.cashAvailable) {
    try {
      const { dataEye: cashEye, text: cashText } = await page.$eval(
        provider.selectors.cashAvailable,
        (element) => ({
          dataEye: element.getAttribute("data-eye") ?? "",
          text: element.textContent?.trim() ?? ""
        })
      );
      const parsedCash = parseAmount(cashEye || cashText);
      cashAmount = Number.isFinite(parsedCash) ? parsedCash : null;
    } catch {
      cashAmount = null;
    }
  }

  const rowsSelector = provider.selectors.assetTableRows;
  const holdings: HoldingPayload[] = [];

  if (rowsSelector) {
    try {
      await page.waitForSelector(rowsSelector, { timeout: 30_000 });
      const rows = await page.$$eval(rowsSelector, (elements) =>
        (elements as HTMLElement[])
          .map((row) => {
            const ariaHidden = row.getAttribute("aria-hidden");
            const display = (row as HTMLElement).style?.display ?? "";
            const hidden = ariaHidden === "true" || display === "none";
            if (hidden || row.classList.contains("table-header")) {
              return null;
            }

            const normalizeText = (value: string) => value.replace(/[\s\u3000]+/g, " ").trim();
            const readText = (element: Element | null) =>
              element?.textContent ? normalizeText(element.textContent) : "";

            const labelCandidates = [
              row.querySelector("th"),
              row.querySelector('[data-label="\u540d\u79f0"]'),
              row.querySelector(".item-content .link"),
              row.querySelector(".link"),
              row.querySelector(".item-content"),
              row.querySelector("td")
            ].filter((candidate): candidate is Element => candidate !== null);

            const label =
              labelCandidates.map((candidate) => readText(candidate)).find((value) => value.length > 0) ?? "";
            if (!label) {
              return null;
            }

            const cells = Array.from(row.querySelectorAll("td")) as HTMLElement[];
            const marketContainer =
              (row.querySelector('[data-label="\u8a55\u4fa1\u984d"]') as HTMLElement | null) ?? cells[0] ?? null;
            const profitContainer =
              (row.querySelector('[data-label="\u8a55\u4fa1\u640d\u76ca"]') as HTMLElement | null) ?? cells[1] ?? null;

            const resolveValue = (element: HTMLElement | null | undefined, preferSelector?: string) => {
              if (!element) {
                return { dataEye: "", text: "" };
              }
              const preferred =
                (preferSelector ? element.querySelector(preferSelector) : null) ?? undefined;
              const primary =
                preferred ??
                (element.hasAttribute("data-eye") ? element : element.querySelector("[data-eye]")) ??
                element.querySelector("p, span, div");
              const target = (primary ?? element) as HTMLElement;
              return {
                dataEye: target.getAttribute("data-eye") ?? "",
                text: readText(target)
              };
            };

            const { dataEye: marketDataEye, text: marketText } = resolveValue(marketContainer);
            const { dataEye: profitDataEye, text: profitText } = resolveValue(profitContainer, ".css-1rwg6wl");

            return { label, marketText, profitText, marketDataEye, profitDataEye };
          })
          .filter(
            (row): row is {
              label: string;
              marketText: string;
              profitText: string;
              marketDataEye: string;
              profitDataEye: string;
            } => row !== null
          )
      );

      for (const row of rows) {
        const normalizedLabel = row.label.replace(/[\s\u3000]+/g, " ").trim();
        if (normalizedLabel.length === 0) {
          continue;
        }

        if (
          provider.key === "sbi-securities" &&
          (normalizedLabel.includes("\u9280\u884c\u53e3\u5ea7") || normalizedLabel.includes("\u5408\u8a08"))
        ) {
          logs.push(`provider filter skipped row: ${normalizedLabel}`);
          continue;
        }

        let category = findProviderCategoryByLabel(provider.key, normalizedLabel);
        if (!category && provider.key === "sbi-securities") {
          const slug = slugifyForSymbol(normalizedLabel);
          category = {
            key: `dynamic-${slug}`,
            label: normalizedLabel,
            group: "\u904b\u7528\u8cc7\u7523",
            symbol: `${provider.holdings.totalSymbol}-${slug}`
          };
        }

        if (!category) {
          logs.push(`unmapped asset row skipped: ${normalizedLabel}`);
          continue;
        }

        const marketValue = parseAmount(row.marketDataEye || row.marketText);
        if (!Number.isFinite(marketValue)) {
          logs.push(`invalid market value for ${normalizedLabel}: ${row.marketText}`);
          continue;
        }

        const parsedProfit = parseAmount(row.profitDataEye || row.profitText);
        const profitAmount = Number.isFinite(parsedProfit) ? parsedProfit : null;
        const costAmountRaw = profitAmount != null ? marketValue - profitAmount : marketValue;
        const costAmount = Number.isFinite(costAmountRaw) ? costAmountRaw : marketValue;

        holdings.push({
          symbol: category.symbol,
          name: row.label,
          quantity: 1,
          costAmount: costAmount >= 0 ? costAmount : 0,
          marketValue,
          currency: "JPY",
          profitAmount: profitAmount ?? undefined,
          group: category.group
        });

        logs.push(
          `category ${normalizedLabel}: market=${marketValue.toLocaleString("ja-JP")}, profit=${
            profitAmount != null ? profitAmount.toLocaleString("ja-JP") : "n/a"
          }`
        );
      }
    } catch {
      logs.push("asset breakdown table not found; continuing with total only");
    }
  }

  const linkedAccountMap = new Map<ProviderKey, HoldingPayload[]>();

  if (provider.linkedSnapshots?.length) {
    for (const snapshot of provider.linkedSnapshots) {
      try {
        const values = await page.$$eval(
          snapshot.selector,
          (elements) => {
            const normalize = (value: string) => value.replace(/[\s\u3000]+/g, " ").trim();
            const readLabel = (element: HTMLElement): string => {
              const row = element.closest("tr");
              if (row) {
                const candidates = [
                  row.querySelector("th"),
                  row.querySelector('[data-label="\u540d\u79f0"]'),
                  row.querySelector(".item-content .link"),
                  row.querySelector(".link"),
                  row.querySelector(".item-content"),
                  row.querySelector("td")
                ].filter((candidate): candidate is Element => candidate !== null);
                for (const candidate of candidates) {
                  const text = candidate.textContent ? normalize(candidate.textContent) : "";
                  if (text.length > 0) {
                    return text;
                  }
                }
              }
              const parent = element.parentElement;
              if (parent?.textContent) {
                return normalize(parent.textContent);
              }
              return element.textContent ? normalize(element.textContent) : "";
            };

            return (elements as HTMLElement[])
              .map((element) => {
                const dataEye = element.getAttribute("data-eye") ?? "";
                const text = element.textContent ? normalize(element.textContent) : "";
                const raw = dataEye || text;
                if (!raw) {
                  return { raw: "", value: NaN, label: "" };
                }
                const numeric = raw.replace(/[^\d.-]/g, "");
                return {
                  raw,
                  value: Number.parseFloat(numeric),
                  label: readLabel(element)
                };
              })
              .filter((entry) => Number.isFinite(entry.value));
          }
        );

        if (values.length === 0) {
          logs.push(
            `linked snapshot parse failed for ${snapshot.provider}: selector=${snapshot.selector} produced no numeric values`
          );
          continue;
        }

        const tokens =
          snapshot.labelIncludes?.map((token) => token.replace(/[\s\u3000]+/g, " ").trim()).filter((token) => token.length > 0) ??
          [];
        const labelMatched =
          tokens.length > 0
            ? values.filter((entry) => {
                const normalizedLabel = entry.label.replace(/[\s\u3000]+/g, " ").trim();
                return tokens.some((token) => normalizedLabel.includes(token));
              })
            : [];

        if (tokens.length > 0 && labelMatched.length === 0) {
          logs.push(
            `linked snapshot skipped for ${snapshot.provider}: selector=${snapshot.selector} did not contain expected labels (${tokens.join(
              ", "
            )})`
          );
          continue;
        }

        const candidates = labelMatched.length > 0 ? labelMatched : values;

        const preferred =
          candidates.find((entry) => entry.value > 0) ??
          candidates.find((entry) => entry.value === 0) ??
          candidates[0];
        const amount = preferred.value;

        const payload: HoldingPayload = {
          symbol: snapshot.symbol,
          name: snapshot.label,
          quantity: 1,
          costAmount: amount,
          marketValue: amount,
          currency: snapshot.currency ?? "JPY",
          profitAmount: undefined,
          group: snapshot.group
        };

        const current = linkedAccountMap.get(snapshot.provider) ?? [];
        linkedAccountMap.set(snapshot.provider, [...current, payload]);

        logs.push(
          `linked snapshot captured for ${snapshot.provider}: ${amount.toLocaleString(
            "ja-JP"
          )} (${snapshot.selector}, raw="${preferred.raw}", label="${preferred.label}")`
        );
      } catch (error) {
        logs.push(
          `linked snapshot selector unavailable for ${snapshot.provider}: ${snapshot.selector} (${
            error instanceof Error ? error.message : "unknown error"
          })`
        );
      }
    }
  }

  const linkedAccounts = Array.from(linkedAccountMap.entries()).map(([providerKey, entries]) => ({
    provider: providerKey,
    holdings: entries
  }));

  const baseHoldings =
    holdings.length === 0 ? fallbackFromSnapshot(provider, totalAmount, cashAmount) : holdings;

  return { holdings: baseHoldings, linkedAccounts };
};
