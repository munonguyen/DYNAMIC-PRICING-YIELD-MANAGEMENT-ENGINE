import type { PriceQuote, PublishedListing } from '@/types/domain';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8080/api/v1';

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 2200): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const mobileApiClient = {
  async getDynamicPriceQuote(
    listing: PublishedListing,
    slotStart: string
  ): Promise<PriceQuote> {
    const matchedSlot = listing.upcomingSlots.find((s) => s.slotStart === slotStart);
    const fallbackPrice = matchedSlot?.currentDynamicPrice ?? listing.basePrice;
    const slotEnd =
      matchedSlot?.slotEnd ??
      new Date(new Date(slotStart).getTime() + listing.slotMinutes * 60_000).toISOString();

    const remote = await fetchJsonWithTimeout<PriceQuote>(
      `${API_BASE_URL}/pricing/quote?groupId=${encodeURIComponent(
        listing.groupId
      )}&slotStart=${encodeURIComponent(slotStart)}`
    );

    if (remote?.currentPrice) {
      return remote;
    }

    return {
      groupId: listing.groupId,
      slotStart,
      slotEnd,
      currentPrice: fallbackPrice,
      priceLockToken: `LOCK_RN_${listing.groupCode}_${Date.now().toString(36).toUpperCase()}`,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    };
  },
};

