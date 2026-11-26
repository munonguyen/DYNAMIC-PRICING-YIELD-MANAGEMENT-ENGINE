import React from 'react';
import { LessorShopView } from '../components/LessorShopView';

type LessorShopPageProps = React.ComponentProps<typeof LessorShopView>;

export const LessorShopPage: React.FC<LessorShopPageProps> = (props) => (
  <div className="pt-14 sm:pt-16">
    <LessorShopView {...props} />
  </div>
);

