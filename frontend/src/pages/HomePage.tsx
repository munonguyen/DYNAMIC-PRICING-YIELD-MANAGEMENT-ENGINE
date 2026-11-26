import React from 'react';
import type {
  AppPageId,
  PriceQuote,
  SportTypeItem,
  VenueLocationInfo,
} from '../types/marketplace';
import { FairwayHero } from '../components/FairwayHero';
import { HomeShowcaseSections } from '../components/HomeShowcaseSections';

interface HomePageProps {
  sports: SportTypeItem[];
  locations: VenueLocationInfo[];
  activeQuote: PriceQuote | null;
  onNavigate: (page: AppPageId) => void;
  onBrowseSportPage: (sportCode: string) => void;
  onBrowseVenueCourts: (venueName: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  sports,
  locations,
  activeQuote,
  onNavigate,
  onBrowseSportPage,
  onBrowseVenueCourts,
}) => (
  <>
    <FairwayHero
      sports={sports}
      onNavigate={onNavigate}
      onBrowseSportPage={onBrowseSportPage}
      activeQuote={activeQuote}
    />
    <HomeShowcaseSections
      sports={sports}
      locations={locations}
      onNavigate={onNavigate}
      onBrowseSportPage={onBrowseSportPage}
      onBrowseVenueCourts={onBrowseVenueCourts}
    />
  </>
);

