export interface User { id: string; name: string; email: string; phone: string; role: 'customer' | 'staff' | 'admin'; status: string; favorites: string[]; addresses: Address[]; createdAt: string }
export interface Address { _id?: string; label?: string; line1: string; line2?: string; city: string; phone?: string; notes?: string; isDefault?: boolean }
export interface Category { id: string; name: string; slug: string; icon: string; count?: number }
export interface Variant { name: string; priceDeltaCents: number }
export interface Food {
  id: string; slug: string; name: string; description: string; category: { id: string; name: string; slug: string } | null; image: string;
  priceCents: number; finalPriceCents: number; discountPercent: number; prepMinutes: number; isFeatured: boolean; isChefPick: boolean;
  ingredients: string[]; allergens: string[]; variants: Variant[]; ratingAvg: number; ratingCount: number; soldCount: number; unit: string; maxPerOrder: number;
  available: boolean; lowStock: boolean; createdAt: string;
}
export interface QuoteLine { foodId: string; name: string; image: string; slug: string; variantName: string | null; quantity: number; unitPriceCents: number; discountPerUnitCents: number; finalCents: number; lineTotalCents: number; available: number; itemId?: string }
export interface Totals { subtotalCents: number; discountCents: number; taxCents: number; deliveryFeeCents: number; totalCents: number }
export interface Quote { items: QuoteLine[]; issues: { foodId: string; code: string; message: string; available?: number }[]; totals: Totals; currency: string; couponCode: string | null; couponError: string | null; minOrderCents: number }
export interface OrderItem { id: string; foodId: string; name: string; image?: string; variantName?: string; unitPriceCents: number; discountPerUnitCents: number; quantity: number; lineTotalCents: number }
export interface Order extends Totals {
  id: string; orderNumber: string; status: string; statusLabel: string; paymentStatus: string; paymentMethod: string; items: OrderItem[]; currency: string; couponCode?: string;
  customer: { name: string; phone: string; email?: string }; address: Address; instructions?: string; notes?: string; estimatedDeliveryAt?: string; createdAt: string;
  timeline: { status: string; label: string; note?: string; at: string }[]; reviews?: Record<string, { id: string; rating: number; comment: string }>; canReview?: boolean; paymentId?: string | null;
  stockState?: string; payments?: any[]; movements?: any[];
}
export interface Review { id: string; rating: number; comment: string; createdAt: string; user: { id: string; name: string } }
export interface Meta { page: number; limit: number; total: number; pages: number }
export interface PublicSettings { name: string; email: string; phone: string; address: string; currency: string; taxRatePercent: number; deliveryFeeCents: number; freeDeliveryOverCents: number; minOrderCents: number; openingHours: { day: number; open: string; close: string; closed: boolean }[]; deliveryAreas: string[]; deliveryMinutes: number }
