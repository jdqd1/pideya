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
