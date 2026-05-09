export type RewardKind = 'free-item' | 'percent' | 'bogo' | 'combo'

export interface RewardDefinition {
  threshold: number
  title: string
  subtitle: string
  kind: RewardKind
  value?: number
  capUsd?: number
  expiresInDays: number
}

export type LevelId = 'nivel-0' | 'nivel-1' | 'nivel-2' | 'nivel-3' | 'nivel-4'

export interface LevelMonthlyCoupon {
  percent: number
  quantity: number
}

export interface LevelPerks {
  monthlyCoupons?: LevelMonthlyCoupon[]
  monthlyCouponExpiryDays?: number
  monthlyCouponRenewDay?: number
  earlyAccessDays?: number
}

export interface LevelDefinition {
  id: LevelId
  name: string
  description: string
  minPoints: number
  windowDays: number
  perks: LevelPerks
  badge: {
    color: string
    icon: string
    tagline: string
  }
}

export interface LoyaltyRulesResponse {
  pointsPerProduct: number
  firstThreshold: number
  thresholdStep: number
  couponExpiryDays: number
  levelMonthlyCouponExpiryDays?: number
  levelMonthlyCouponRenewDay?: number
  rewardLadder: RewardDefinition[]
  levelWindowDays?: number
  levelLadder?: LevelDefinition[]
}

export const loyaltyRules = {
  pointsPerProduct: 1,
  firstThreshold: 5,
  thresholdStep: 5,
  couponExpiryDays: 60,
  levelMonthlyCouponExpiryDays: 14,
  levelMonthlyCouponRenewDay: 1,
}

export const levelWindowDays = 0

export const levelLadder: LevelDefinition[] = [
  {
    id: 'nivel-0',
    name: 'Nivel 0',
    description: 'Empieza a probar sabores y suma puntos en tus primeras compras.',
    minPoints: 0,
    windowDays: levelWindowDays,
    perks: {
      monthlyCoupons: [],
      monthlyCouponExpiryDays: loyaltyRules.levelMonthlyCouponExpiryDays,
      monthlyCouponRenewDay: loyaltyRules.levelMonthlyCouponRenewDay,
      earlyAccessDays: 0,
    },
    badge: {
      color: '#8B5CF6',
      icon: 'sparkles',
      tagline: 'Nivel 0',
    },
  },
  {
    id: 'nivel-1',
    name: 'Nivel 1',
    description: 'Visitas frecuentes: recibe 1 cupon mensual de 10% (vigencia 14 dias).',
    minPoints: 15,
    windowDays: levelWindowDays,
    perks: {
      monthlyCoupons: [{ percent: 10, quantity: 1 }],
      monthlyCouponExpiryDays: loyaltyRules.levelMonthlyCouponExpiryDays,
      monthlyCouponRenewDay: loyaltyRules.levelMonthlyCouponRenewDay,
      earlyAccessDays: 0,
    },
    badge: {
      color: '#10B981',
      icon: 'flame',
      tagline: 'Nivel 1',
    },
  },
  {
    id: 'nivel-2',
    name: 'Nivel 2',
    description: 'Compras constantes: 1 cupon mensual de 15% (vigencia 14 dias).',
    minPoints: 40,
    windowDays: levelWindowDays,
    perks: {
      monthlyCoupons: [{ percent: 15, quantity: 1 }],
      monthlyCouponExpiryDays: loyaltyRules.levelMonthlyCouponExpiryDays,
      monthlyCouponRenewDay: loyaltyRules.levelMonthlyCouponRenewDay,
      earlyAccessDays: 0,
    },
    badge: {
      color: '#F59E0B',
      icon: 'crown',
      tagline: 'Nivel 2',
    },
  },
  {
    id: 'nivel-3',
    name: 'Nivel 3',
    description: 'Comprador experto: 1 cupon mensual de 20% y 1 de 10% (vigencia 14 dias).',
    minPoints: 80,
    windowDays: levelWindowDays,
    perks: {
      monthlyCoupons: [
        { percent: 20, quantity: 1 },
        { percent: 10, quantity: 1 },
      ],
      monthlyCouponExpiryDays: loyaltyRules.levelMonthlyCouponExpiryDays,
      monthlyCouponRenewDay: loyaltyRules.levelMonthlyCouponRenewDay,
      earlyAccessDays: 0,
    },
    badge: {
      color: '#2563EB',
      icon: 'diamond',
      tagline: 'Nivel 3',
    },
  },
  {
    id: 'nivel-4',
    name: 'Nivel 4',
    description: 'Maxima lealtad: 1 cupon mensual de 25% y 1 de 15% (vigencia 14 dias).',
    minPoints: 120,
    windowDays: levelWindowDays,
    perks: {
      monthlyCoupons: [
        { percent: 25, quantity: 1 },
        { percent: 15, quantity: 1 },
      ],
      monthlyCouponExpiryDays: loyaltyRules.levelMonthlyCouponExpiryDays,
      monthlyCouponRenewDay: loyaltyRules.levelMonthlyCouponRenewDay,
      earlyAccessDays: 0,
    },
    badge: {
      color: '#EC4899',
      icon: 'trophy',
      tagline: 'Nivel 4',
    },
  },
]

export const rewardLadder: RewardDefinition[] = [
  { threshold: 5, title: 'Producto gratis', subtitle: 'Cubre articulos hasta $5', kind: 'free-item', capUsd: 5, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 10, title: '15% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 15, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 15, title: 'Producto gratis', subtitle: 'Cubre articulos hasta $8', kind: 'free-item', capUsd: 8, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 20, title: '20% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 20, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 25, title: '2x1 en brownies', subtitle: 'Paga 1 y lleva 2', kind: 'bogo', expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 30, title: 'Producto gratis premium', subtitle: 'Cubre articulos hasta $10', kind: 'free-item', capUsd: 10, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 35, title: '25% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 25, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 40, title: 'Producto gratis + bebida', subtitle: 'Cubre articulo hasta $12', kind: 'combo', capUsd: 12, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 45, title: '30% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 30, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 50, title: 'Combo dulce gratis', subtitle: 'Cubre combos hasta $15', kind: 'combo', capUsd: 15, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 55, title: 'Producto gratis premium', subtitle: 'Cubre articulos hasta $12 (repeticion)', kind: 'free-item', capUsd: 12, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 60, title: 'Producto especial', subtitle: 'Cubre articulos hasta $14', kind: 'free-item', capUsd: 14, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 65, title: '35% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 35, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 70, title: 'Combo premium', subtitle: 'Incluye bebida y postre', kind: 'combo', capUsd: 18, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 75, title: 'Producto gourmet', subtitle: 'Cubre articulos hasta $16', kind: 'free-item', capUsd: 16, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 80, title: '40% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 40, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 85, title: 'Combo fiesta', subtitle: 'Cubre combos hasta $20', kind: 'combo', capUsd: 20, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 90, title: 'Producto deluxe', subtitle: 'Cubre articulos hasta $18', kind: 'free-item', capUsd: 18, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 95, title: '45% de descuento', subtitle: 'Aplicable a una compra', kind: 'percent', value: 45, expiresInDays: loyaltyRules.couponExpiryDays },
  { threshold: 100, title: 'Mega combo', subtitle: 'Cubre combos hasta $22', kind: 'combo', capUsd: 22, expiresInDays: loyaltyRules.couponExpiryDays },
]

export const getNextThreshold = (
  currentPoints: number,
  firstThreshold: number = loyaltyRules.firstThreshold,
  thresholdStep: number = loyaltyRules.thresholdStep,
) => {
  if (currentPoints < firstThreshold) {
    return firstThreshold
  }

  const beyondFirst = currentPoints - firstThreshold
  const steps = Math.ceil(beyondFirst / thresholdStep)
  return firstThreshold + steps * thresholdStep
}
