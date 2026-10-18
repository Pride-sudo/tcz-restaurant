import type { Quote } from '../../types';
import { money } from '../../utils/format';

export function TotalsTable({ totals, couponCode }: { totals: Quote['totals']; couponCode?: string | null }) {
  const row = (l: string, v: string, strong = false) => <div className={`flex justify-between ${strong ? 'border-t border-line pt-3 text-lg font-extrabold' : 'text-sm'}`}><dt className={strong ? '' : 'text-muted'}>{l}</dt><dd>{v}</dd></div>;
  return (
    <dl className="space-y-2">
      {row('Subtotal', money(totals.subtotalCents))}
      {totals.discountCents > 0 && row(`Coupon${couponCode ? ` (${couponCode})` : ''}`, `-${money(totals.discountCents)}`)}
      {totals.taxCents > 0 && row('Tax', money(totals.taxCents))}
      {row('Delivery', totals.deliveryFeeCents === 0 ? 'Free' : money(totals.deliveryFeeCents))}
      {row('Total', money(totals.totalCents), true)}
    </dl>
  );
}
