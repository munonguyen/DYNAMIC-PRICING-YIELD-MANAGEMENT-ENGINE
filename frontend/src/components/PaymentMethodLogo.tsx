import momoLogo from '../assets/payments/momo.svg';
import vietQrLogo from '../assets/payments/vietqr.png';
import vnPayLogo from '../assets/payments/vnpay.svg';
import type { CheckoutProvider } from '../types/marketplace';

const logos = {
  MOMO_WALLET: { image: momoLogo, name: 'MoMo', widthFactor: 1 },
  VIETQR_NAPAS: { image: vietQrLogo, name: 'VietQR', widthFactor: 2 },
  VNPAY_ESCROW: { image: vnPayLogo, name: 'VNPAY', widthFactor: 2 },
} satisfies Record<CheckoutProvider, { image: string; name: string; widthFactor: number }>;

interface PaymentMethodLogoProps {
  code?: CheckoutProvider | null;
  size?: number;
  decorative?: boolean;
}

export function PaymentMethodLogo({ code, size = 36, decorative = true }: PaymentMethodLogoProps) {
  const logo = code ? logos[code] : undefined;
  if (!logo) return null;

  const height = Math.max(30, size);

  return (
    <img
      src={logo.image}
      alt={decorative ? '' : logo.name}
      width={height * logo.widthFactor}
      height={height}
      className="block shrink-0 object-contain"
      style={{ height }}
    />
  );
}
