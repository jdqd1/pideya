import type { LevelDefinition } from './loyalty'

export type CouponStatus = 'available' | 'used' | 'expired'
export type CouponKind = 'free-item' | 'percent' | 'bogo' | 'combo' | 'gift-card'

export interface UserMini {
  id: string
  email?: string
  cedula?: string | null
}

export interface CouponDto {
  id: string
  title: string
  kind: CouponKind
  threshold: number | null
  value: number | null
  capUsd: number | null
  status: CouponStatus
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  usedAt?: string | null
  verifiedBy?: UserMini | null
  source?: string
}

export interface UserActivityDto {
  id: string
  type: 'WIN' | 'USE' | 'SEND' | 'RECEIVE' | 'LEVEL_UP' | 'LOGIN'
  data: Record<string, any>
  createdAt: string
}

export interface UserCouponsState {
  totalPoints: number
  nextThreshold: number
  coupons: CouponDto[]
  levelState?: UserLevelState
  activity?: UserActivityDto[]
  claims?: ClaimHistoryItem[]
}

export interface ClaimHistoryItem {
  id: string
  code: string
  points: number
  claimedAt: string
  status: 'claimed'
}

export interface AuthUser {
  id: string
  email: string
  role: string
  createdAt: string
  name?: string
  cedula?: string | null
  phoneNumber?: string | null
  isProvisional?: boolean
  provisionalExpiresAt?: string | null
  hasSeenWelcome?: boolean
  hasSeenFirstCoupon?: boolean
  lastGiftSeenAt?: string | null
}

export interface CouponInspectResponse {
  coupon: CouponDto
  owner: UserMini | null
  progress: {
    totalPoints: number
    nextThreshold: number
    coupons: CouponDto[]
    levelState?: UserLevelState
  } | null
}

export interface CouponStats {
  total: number
  available: number
  used: number
  expired: number
}

export interface UserLevelState {
  currentLevel: LevelDefinition
  nextLevel: LevelDefinition | null
  pointsInWindow: number
  windowStart: string
  windowEnd: string
  expiresAt: string | null
  awardedAt: string
  pointsToNext: number | null
  levelChanged?: boolean
  previousLevelId?: string | null
}
