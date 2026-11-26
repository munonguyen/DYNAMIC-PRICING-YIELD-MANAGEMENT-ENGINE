import React from 'react';
import { BookingPipelineAndQrSection } from '../components/BookingPipelineAndQrSection';

type CheckoutPageProps = React.ComponentProps<typeof BookingPipelineAndQrSection>;

export const CheckoutPage: React.FC<CheckoutPageProps> = (props) => (
  <div className="pt-10 sm:pt-12">
    <BookingPipelineAndQrSection {...props} />
  </div>
);

