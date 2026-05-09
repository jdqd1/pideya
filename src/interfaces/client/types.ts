import type { Dispatch, SetStateAction, RefObject } from "react"
import type { LoyaltyRulesResponse, LevelDefinition } from "../../types/loyalty"
import type { AuthUser, CouponDto, UserCouponsState, UserLevelState } from "../../types/userState"
import type { CouponActivity, PaymentTicket, PendingSale, ProductDef, ScannedProduct, ScannerState } from "../../types/app"

export type ClaimFormState = { code: string; status: string }

export type ClientInterfaceProps = {
    user: AuthUser | null
    currentState: UserCouponsState
    levelState: UserLevelState
    nextReward: LoyaltyRulesResponse["rewardLadder"][number] | null
    punchSlots: number
    punchesFilled: number
    showRewardAnimation: boolean
    punchPopVersion: number
    claimScanner: ScannerState
    setClaimScanner: Dispatch<SetStateAction<ScannerState>>
    claimForm: ClaimFormState
    setClaimForm: Dispatch<SetStateAction<ClaimFormState>>
    scannedProduct: ScannedProduct | null
    setScannedProduct: Dispatch<SetStateAction<ScannedProduct | null>>
    loadingAction: boolean
    onConfirmScannedProduct: (code: string) => void | Promise<void>
    stageScannedProduct: (rawCode: string, source?: "scan" | "manual") => void
    claimVideoRef: RefObject<HTMLVideoElement>
    redeemModal: { active: boolean; coupon: CouponDto | null; qr: string | null }
    setRedeemModal: Dispatch<SetStateAction<{ active: boolean; coupon: CouponDto | null; qr: string | null }>>
    coupons: CouponDto[]
    formatCouponSubtitle: (coupon: CouponDto) => string
    getCouponStatusLabel: (status: CouponDto["status"]) => string
    openRedeemModal: (coupon: CouponDto) => void
    onGiftCoupon: (coupon: CouponDto, email: string) => Promise<{ ok: boolean; message?: string }>
    giftingCouponId: string | null
    confirmedHistory: ScannedProduct[]
    couponEvents: CouponActivity[]
    pendingPurchases: PendingSale[]
    showPendingNotice: boolean
    onDismissPendingNotice: () => void
    ladder: LoyaltyRulesResponse["rewardLadder"]
    levelLadder: LevelDefinition[]
    catalog: ProductDef[]
    onCreateTicket: (ticket: Omit<PaymentTicket, "id" | "status" | "createdAt" | "confirmedAt">) => Promise<PaymentTicket | void>
    paymentTickets: PaymentTicket[]
    onLogout: () => void
    onUpdateProfile: (data: { phone?: string; cedula?: string; name?: string; hasSeenWelcome?: boolean; hasSeenFirstCoupon?: boolean; lastGiftSeenAt?: string | null }) => Promise<void>
}

export type CartItem = {
    id: string
    name: string
    price: number
    points: number
    quantity: number
    imageUrl?: string
}

export type PaymentFormState = {
    bank: string
    phone: string
    documentType: PaymentTicket["documentType"]
    documentNumber: string
    reference: string
}

export type RedeemModalProps = {
    redeemModal: { active: boolean; coupon: CouponDto | null; qr: string | null }
    setRedeemModal: Dispatch<SetStateAction<{ active: boolean; coupon: CouponDto | null; qr: string | null }>>
}

export type GiftModalProps = {
    modal: { active: boolean; coupon: CouponDto | null }
    email: string
    status: string
    loading: boolean
    giftingCouponId: string | null
    onClose: () => void
    onSend: () => void
    onEmailChange: Dispatch<SetStateAction<string>>
    isSuccess: boolean
}

export type ActivityItem =
    | (PendingSale & { type: "pending" })
    | (ScannedProduct & { type: "confirmed" })
    | (CouponActivity & { type: "coupon"; activityType?: string })
    | (PaymentTicket & { type: "ticket" })
