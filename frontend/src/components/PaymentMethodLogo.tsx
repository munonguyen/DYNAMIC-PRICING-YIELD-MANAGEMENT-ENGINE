import React from 'react';
import type { CheckoutProvider } from '../types/marketplace';

interface PaymentMethodLogoProps {
  code: CheckoutProvider;
  size?: number;
}

export const PaymentMethodLogo: React.FC<PaymentMethodLogoProps> = ({ code, size = 36 }) => {
  if (code === 'MOMO_WALLET') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="shrink-0 rounded-xl shadow-2xs"
      >
        <rect width="40" height="40" rx="10" fill="#A50064" />
        <circle cx="14.5" cy="16" r="4.2" stroke="#FFFFFF" strokeWidth="2.4" />
        <circle cx="25.5" cy="16" r="4.2" stroke="#FFFFFF" strokeWidth="2.4" />
        <path
          d="M11 26.5c0-2.1 1.6-3.5 3.6-3.5 1.9 0 3.4 1.4 3.4 3.5v2.2h-7v-2.2Zm11 0c0-2.1 1.6-3.5 3.6-3.5 1.9 0 3.4 1.4 3.4 3.5v2.2h-7v-2.2Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }

  if (code === 'VNPAY_ESCROW') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
        className="shrink-0 rounded-xl shadow-2xs"
      >
        <rect width="40" height="40" rx="10" fill="#FFFFFF" stroke="#E2E8F0" />
        <path d="M8 13.5h7.2l4.8 11.4L24.8 13.5H32L22.3 29h-4.6L8 13.5Z" fill="#005BAA" />
        <path d="M18.6 10.5 24 23.2l2.7-6.4-2.4-6.3h-5.7Z" fill="#ED1C24" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className="shrink-0 rounded-xl shadow-2xs"
    >
      <rect width="40" height="40" rx="10" fill="#FFFFFF" stroke="#E2E8F0" />
      <rect x="7.5" y="7.5" width="9.5" height="9.5" rx="2" stroke="#0B3B78" strokeWidth="2.4" />
      <rect x="11" y="11" width="2.5" height="2.5" fill="#D92027" />
      <rect x="23" y="7.5" width="9.5" height="9.5" rx="2" stroke="#0B3B78" strokeWidth="2.4" />
      <rect x="26.5" y="11" width="2.5" height="2.5" fill="#0B3B78" />
      <rect x="7.5" y="23" width="9.5" height="9.5" rx="2" stroke="#0B3B78" strokeWidth="2.4" />
      <rect x="11" y="26.5" width="2.5" height="2.5" fill="#0B3B78" />
      <path
        d="M23 23h4v4h-4v-4Zm5.5 0h4v4h-4v-4ZM23 28.5h4v4h-4v-4Zm5.5 2.5h4v1.5h-4V31Z"
        fill="#D92027"
      />
    </svg>
  );
};

