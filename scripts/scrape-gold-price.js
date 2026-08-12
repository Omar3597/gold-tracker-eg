// scripts/scrape-gold-price.js
// Runs in GitHub Actions (Node 20+, has built-in fetch). No npm install needed.
// Scrapes the public iSagha Egypt gold price page and writes public/prices.json.

import { writeFile, mkdir } from "node:fs/promises";

const SOURCE_URL = "https://market.isagha.com/prices/eg";
const OUTPUT_PATH = "public/prices.json";

async function main() {
  const res = await fetch(SOURCE_URL, {
    headers: {
      // A normal browser UA is enough — no auth/keys involved, this is a public page.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch iSagha page: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // Strip tags -> plain text, collapse whitespace. This mirrors the stable
  // Arabic label text on the page rather than relying on CSS classes,
  // which are far more likely to change than the wording.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Pattern per row, in the order the page renders them:
  // "عيار {karat} ... يبيع به التاجر للعميل {sell} ج.م ... يشتري به التاجر من العميل {buy} ج.م"
  const rowPattern =
    /عيار\s*(\d+)[\s\S]{0,120}?يبيع به التاجر للعميل\s*([\d.,]+)\s*ج\.م[\s\S]{0,300}?يشتري به التاجر من العميل\s*([\d.,]+)\s*ج\.م/g;

  const karats = {};
  let match;
  while ((match = rowPattern.exec(text)) !== null) {
    const [, karat, sell, buy] = match;
    karats[`k${karat}`] = {
      karat: Number(karat),
      sellPerGram: Number(sell.replace(/,/g, "")),
      buyPerGram: Number(buy.replace(/,/g, "")),
    };
  }

  if (Object.keys(karats).length === 0) {
    // Page structure likely changed — fail loudly instead of committing bad/empty data.
    throw new Error(
      "No karat prices matched — iSagha page structure may have changed. Inspect SOURCE_URL manually."
    );
  }

  const payload = {
    source: "iSagha (market.isagha.com)",
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
    currency: "EGP",
    unit: "gram",
    karats,
  };

  await mkdir("public", { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${OUTPUT_PATH}:`, payload);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
