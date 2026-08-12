// assets/gold-price.js
// Drop this into your PWA. Loads the price file that the GitHub Action commits.
// Same-origin fetch -> no CORS problems, no API key, no cost.

const PRICES_URL = "./public/prices.json";

/**
 * Fetch the latest committed Egyptian gold prices.
 * Cache-busts with a timestamp param so GitHub Pages' CDN cache
 * doesn't serve you a stale copy right after the Action pushes an update.
 */
export async function getCurrentGoldPrices() {
  const res = await fetch(`${PRICES_URL}?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Could not load prices.json (${res.status})`);
  }
  const data = await res.json();
  return data; // { source, fetchedAt, currency, unit, karats: { k21: { sellPerGram, buyPerGram }, ... } }
}

/**
 * Compare this run's price against the last one recorded in localStorage,
 * for the "Since Last Visit" panel. Call this once on app open.
 */
export function diffAgainstLastVisit(currentData, karat = 21) {
  const key = `lastPrice_k${karat}`;
  const prevRaw = localStorage.getItem(key);
  const current = currentData.karats[`k${karat}`];

  let diff = null;
  if (prevRaw) {
    const prev = JSON.parse(prevRaw);
    const change = current.sellPerGram - prev.sellPerGram;
    diff = {
      previousPrice: prev.sellPerGram,
      previousTimestamp: prev.timestamp,
      currentPrice: current.sellPerGram,
      change,
      changePercent: (change / prev.sellPerGram) * 100,
    };
  }

  localStorage.setItem(
    key,
    JSON.stringify({ sellPerGram: current.sellPerGram, timestamp: currentData.fetchedAt })
  );

  return diff; // null on first-ever visit
}
