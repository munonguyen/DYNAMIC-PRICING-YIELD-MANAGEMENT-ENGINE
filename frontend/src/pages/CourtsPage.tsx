import React from 'react';
import { MarketplaceExplorerSection } from '../components/MarketplaceExplorerSection';

type CourtsPageProps = React.ComponentProps<typeof MarketplaceExplorerSection>;

export const CourtsPage: React.FC<CourtsPageProps> = (props) => (
  <div className="pt-6 sm:pt-8">
    <MarketplaceExplorerSection {...props} />
  </div>
);

