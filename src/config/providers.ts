export type ProviderKey = "rakuten" | "rakuten-bank" | "sbi-securities" | "manual-bank" | "manual-securities";

export type ProviderKind = "securities" | "bank";

export type AssetGroup = "\u904b\u7528\u8cc7\u7523" | "\u73fe\u91d1\u8cc7\u7523";

export type ProviderCategory = {
  key: string;
  label: string;
  group: AssetGroup;
  symbol: string;
};

export type ProviderManualDetection = {
  waitSelector?: string;
  waitUrlPrefix?: string;
  probe?: {
    url: string;
    successUrlIncludes?: string;
  };
};

export type ProviderLinkedSnapshot = {
  provider: ProviderKey;
  selector: string;
  label: string;
  symbol: string;
  group: AssetGroup;
  currency?: string;
  labelIncludes?: readonly string[];
};

export type ProviderDetails = {
  key: ProviderKey;
  label: string;
  kind: ProviderKind;
  login: {
    url: string;
    afterLoginUrl?: string;
  };
  manualDetection?: ProviderManualDetection;
  selectors: {
    assetTotal: string;
    assetTableRows?: string;
    cashAvailable?: string;
  };
  holdings: {
    totalLabel: string;
    totalSymbol: string;
  };
  linkedSnapshots?: readonly ProviderLinkedSnapshot[];
  categories?: readonly ProviderCategory[];
};

const RAKUTEN_CATEGORIES: readonly ProviderCategory[] = [
  {
    key: "domestic-stock",
    label: "\u56fd\u5185\u682a\u5f0f",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-DOMESTIC-STOCK"
  },
  {
    key: "us-stock",
    label: "\u7c73\u56fd\u682a\u5f0f",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-US-STOCK"
  },
  {
    key: "china-stock",
    label: "\u4e2d\u56fd\u682a\u5f0f",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-CHINA-STOCK"
  },
  {
    key: "asean-stock",
    label: "\u30a2\u30bb\u30a2\u30f3\u682a\u5f0f",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-ASEAN-STOCK"
  },
  {
    key: "bond",
    label: "\u50b5\u5238",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-BOND"
  },
  {
    key: "fund",
    label: "\u6295\u8cc7\u4fe1\u8a17",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-FUND"
  },
  {
    key: "money-fund",
    label: "\u697d\u5929\u30fb\u30de\u30cd\u30fc\u30d5\u30a1\u30f3\u30c9",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-MONEY-FUND"
  },
  {
    key: "foreign-mmf",
    label: "\u5916\u8ca8\u5efaMMF",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-INVESTMENT-FOREIGN-MMF"
  },
  {
    key: "deposit-jpy",
    label: "\u9810\u308a\u91d1",
    group: "\u73fe\u91d1\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-CASH-DEPOSIT-JPY"
  },
  {
    key: "deposit-fx",
    label: "\u5916\u8ca8\u9810\u308a\u91d1\u5408\u8a08",
    group: "\u73fe\u91d1\u8cc7\u7523",
    symbol: "RAKUTEN-SECURITIES-CASH-DEPOSIT-FX"
  }
] as const;

const SBI_CATEGORIES: readonly ProviderCategory[] = [
  {
    key: "domestic-stock-cash",
    label: "\u56fd\u5185\u682a\u5f0f(\u73fe\u7269)",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "SBI-SECURITIES-INVESTMENT-DOMESTIC-STOCK"
  },
  {
    key: "fund",
    label: "\u6295\u8cc7\u4fe1\u8a17",
    group: "\u904b\u7528\u8cc7\u7523",
    symbol: "SBI-SECURITIES-INVESTMENT-FUND"
  }
] as const;

export const PROVIDER_CONFIG: Record<ProviderKey, ProviderDetails> = {
  rakuten: {
    key: "rakuten",
    label: "楽天証券",
    kind: "securities",
    login: {
      url: "https://www.rakuten-sec.co.jp/ITS/V_ACT_Login.html",
      afterLoginUrl:
        "https://member.rakuten-sec.co.jp/app/com_page_template.do?eventType=init&gmn=H&smn=01&lmn=&fmn="
    },
    manualDetection: {
      waitSelector: "#asset_total_amount",
      waitUrlPrefix: "https://member.rakuten-sec.co.jp/app/home.do"
    },
    selectors: {
      assetTotal: "#asset_total_amount",
      assetTableRows: ".pcmm-m1-home-assets-table tbody tr"
    },
    holdings: {
      totalLabel: "楽天証券 資産合計",
      totalSymbol: "RAKUTEN-SECURITIES-TOTAL"
    },
    linkedSnapshots: [
      {
        provider: "rakuten-bank",
        selector: ".pcmm-m1-home-assets-table__amount",
        label: "楽天銀行 資産合計",
        symbol: "RAKUTEN-BANK-TOTAL",
        group: "\u73fe\u91d1\u8cc7\u7523",
        currency: "JPY",
        labelIncludes: ["楽天銀行"]
      }
    ],
    categories: RAKUTEN_CATEGORIES
  },
  "rakuten-bank": {
    key: "rakuten-bank",
    label: "楽天銀行",
    kind: "bank",
    login: {
      url: "https://www.rakuten-bank.co.jp/",
      afterLoginUrl:
        "https://fes.rakuten-bank.co.jp/XMS/inquiry/gns?=&CurrentPageID=HEADER_FOOTER_LINK&COMMAND=BALANCE_INQUIRY_START"
    },
    manualDetection: {
      waitSelector: ".balanceResult__amount span.amount",
      waitUrlPrefix: "https://fes.rakuten-bank.co.jp/",
      probe: {
        url: "https://fes.rakuten-bank.co.jp/XMS/inquiry/gns?=&CurrentPageID=HEADER_FOOTER_LINK&COMMAND=BALANCE_INQUIRY_START",
        successUrlIncludes: "/XMS/inquiry/gns"
      }
    },
    selectors: {
      assetTotal: ".balanceResult__amount span.amount"
    },
    holdings: {
      totalLabel: "楽天銀行 資産合計",
      totalSymbol: "RAKUTEN-BANK-TOTAL"
    }
  },
  "manual-bank": {
    key: "manual-bank",
    label: "手動銀行口座",
    kind: "bank",
    login: {
      url: "about:blank"
    },
    selectors: {
      assetTotal: "#manual-bank-asset-total"
    },
    holdings: {
      totalLabel: "手動銀行 資産合計",
      totalSymbol: "MANUAL-BANK-TOTAL"
    }
  },
  "manual-securities": {
    key: "manual-securities",
    label: "\u624b\u52d5\u8a3c\u5238\u53e3\u5ea7",
    kind: "securities",
    login: {
      url: "about:blank"
    },
    selectors: {
      assetTotal: "#manual-securities-asset-total"
    },
    holdings: {
      totalLabel: "\u624b\u52d5\u8a3c\u5238 \u8cc7\u7523\u5408\u8a08",
      totalSymbol: "MANUAL-SECURITIES-TOTAL"
    }
  },
  "sbi-securities": {
    key: "sbi-securities",
    label: "SBI証券",
    kind: "securities",
    login: {
      url: "https://www.sbisec.co.jp/ETGate/?_ControlID=WPLETlgR001Control&_PageID=WPLETlgR001Rlgn50&_DataStoreID=DSWPLETlgR001Control&_ActionID=login&getFlg=on",
      afterLoginUrl: "https://site.sbisec.co.jp/account/assets"
    },
    manualDetection: {
      waitSelector:
        'ul[data-responsive="true"] > li:last-child [data-label="\u8a55\u4fa1\u984d"] p',
      waitUrlPrefix: "https://site.sbisec.co.jp/account/assets"
    },
    selectors: {
      assetTotal: 'ul[data-responsive="true"] > li:last-child [data-label="\u8a55\u4fa1\u984d"] p',
      assetTableRows: 'ul[data-responsive="true"] > li.table-row'
    },
    holdings: {
      totalLabel: "SBI証券 資産合計",
      totalSymbol: "SBI-SECURITIES-TOTAL"
    },
    categories: SBI_CATEGORIES
  }
};

export type ProviderOption = {
  value: ProviderKey;
  label: string;
};

const SECURITIES_PROVIDER_ORDER: ProviderKey[] = ["rakuten", "sbi-securities", "manual-securities"];

export const SECURITIES_PROVIDER_OPTIONS: readonly ProviderOption[] = SECURITIES_PROVIDER_ORDER
  .map((key) => PROVIDER_CONFIG[key])
  .filter((provider): provider is ProviderDetails => provider.kind === "securities")
  .map(({ key, label }) => ({ value: key, label }));

export const BANK_PROVIDER_OPTIONS: readonly ProviderOption[] = Object.values(PROVIDER_CONFIG)
  .filter((provider) => provider.kind === "bank")
  .map(({ key, label }) => ({ value: key, label }));

export const findProviderCategoryByLabel = (providerKey: ProviderKey, label: string) => {
  const categories = PROVIDER_CONFIG[providerKey].categories;
  if (!categories) {
    return undefined;
  }
  const normalize = (value: string) => value.replace(/[\s\u3000]+/g, " ").trim();
  const stripParentheses = (value: string) => normalize(value).replace(/[（(][^（）()]*[）)]/g, "").trim();

  const normalizedLabel = normalize(label);
  const strippedLabel = stripParentheses(label);

  return (
    categories.find((category) => normalize(category.label) === normalizedLabel) ??
    categories.find((category) => stripParentheses(category.label) === strippedLabel)
  );
};
