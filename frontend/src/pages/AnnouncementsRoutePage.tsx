import React from 'react';
import { AnnouncementsPage } from '../components/AnnouncementsPage';

type AnnouncementsRoutePageProps = React.ComponentProps<typeof AnnouncementsPage>;

export const AnnouncementsRoutePage: React.FC<AnnouncementsRoutePageProps> = (props) => (
  <div className="pt-10 sm:pt-12">
    <AnnouncementsPage {...props} />
  </div>
);

