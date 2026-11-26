import React from 'react';
import type {
  AppPageId,
  PriceQuote,
  PublishedListing,
  SportTypeItem,
  VenueLocationInfo,
} from '../types/marketplace';
import { FairwayHero } from '../components/FairwayHero';
import { HomeShowcaseSections } from '../components/HomeShowcaseSections';

interface HomePageProps {
  sports: SportTypeItem[];
  listings?: PublishedListing[];
  locations: VenueLocationInfo[];
  activeQuote: PriceQuote | null;
  onNavigate: (page: AppPageId) => void;
  onBrowseSportPage: (sportCode: string) => void;
  onBrowseVenueCourts: (venueName: string) => void;
  onQuickSearch?: (sportCode: string, city: string) => void;
  onSelectCourt?: (listing: PublishedListing, preferredSlotStart?: string) => void;
  onOpenLessorShop?: (providerId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  sports,
  listings = [],
  locations,
  activeQuote,
  onNavigate,
  onBrowseSportPage,
  onBrowseVenueCourts,
  onQuickSearch,
  onSelectCourt,
  onOpenLessorShop,
}) => {
  const totalOpenCourts = listings.reduce(
    (sum, item) => sum + Math.max(0, ...item.upcomingSlots.map((s) => s.availableCourts)),
    0
  );

  return (
    <>
      <FairwayHero
        sports={sports}
        totalOpenCourts={totalOpenCourts > 0 ? totalOpenCourts : 48}
        onNavigate={onNavigate}
        onBrowseSportPage={onBrowseSportPage}
        onQuickSearch={onQuickSearch}
        activeQuote={activeQuote}
      />
      <HomeShowcaseSections
        sports={sports}
        listings={listings}
        locations={locations}
        onNavigate={onNavigate}
        onBrowseSportPage={onBrowseSportPage}
        onBrowseVenueCourts={onBrowseVenueCourts}
        onSelectCourt={onSelectCourt}
        onOpenLessorShop={onOpenLessorShop}
      />
    </>
  );
};
