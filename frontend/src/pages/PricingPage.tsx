import React from 'react';
import { YieldTelemetryBentoSection } from '../components/YieldTelemetryBentoSection';

type PricingPageProps = React.ComponentProps<typeof YieldTelemetryBentoSection>;

export const PricingPage: React.FC<PricingPageProps> = (props) => (
  <div className="pt-10 sm:pt-12">
    <YieldTelemetryBentoSection {...props} />
  </div>
);

