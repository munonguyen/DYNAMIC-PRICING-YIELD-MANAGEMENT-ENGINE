import React from 'react';
import { MonteCarloAndRoleCenterSection } from '../components/MonteCarloAndRoleCenterSection';

type GovernancePageProps = React.ComponentProps<typeof MonteCarloAndRoleCenterSection>;

export const GovernancePage: React.FC<GovernancePageProps> = (props) => (
  <div className="pt-10 sm:pt-12">
    <MonteCarloAndRoleCenterSection {...props} />
  </div>
);

