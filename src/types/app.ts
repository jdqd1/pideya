import type { CouponInspectResponse } from "./userState"

export type ScannerState = { active: boolean; status: string; last: string; error?: string }

export type ToastTone = "success" | "error" | "info"

export interface Toast {
  id: string
  message: string
  tone: ToastTone
}
export type ProductDef = {
  id?: string
  name: string
  price: number
  points: number
  stock?: number
  cost?: number
  active?: boolean
  available?: boolean
  stockStatus?: "available" | "out_of_stock"
  imageUrl?: string
  description?: string
}

export type ScannedProduct = {
  code: string
  name: string
  price: number
  points: number
  scannedAt: string
  productId?: string
  productIndex?: number
  quantity?: number
  codes?: string[]
  origin?: "scan" | "sale" | "special-scan"
  status: "pending" | "confirmed" | "duplicate" | "invalid" | "used"
  currency?: string
}

export type CartItem = ProductDef & { quantity: number }

export type PendingSale = {
  code: string
  name: string
  price: number
  points: number
  createdAt: string
  productId?: string
  quantity?: number
  codes?: string[]
}

export type GeneratedQrRecord = {
  id: string
  productId?: string
  productName: string
  createdAt: string
  usedAt?: string | null
  points: number
  price: number
  persisted: boolean
}

export type CouponActivity = {
  couponId: string
  title: string
  kind: string
  status: string
  direction: "in" | "out"
  peer?: string | null
  at: string
  activityType?: string
}

export type SalesEvent = {
  key: string
  productId?: string
  name: string
  price: number
  points?: number
  quantity?: number
  scannedAt: string
  currency?: string
  source?: string
  occurredAt?: string
  code?: string
  codes?: string[]
  exchangeRate?: number
  exchangeRateDate?: string | null
  paymentMethod?: string | null
  paymentDetails?: {
    method: string
    amount: number
    currency?: string
    amountNative?: number
    currencyNative?: string
    amountUsd?: number
    exchangeRate?: number | null
  }[]
  customerId?: string | null
  customerEmail?: string | null
  customerName?: string | null
  customerPhone?: string | null
  documentType?: "V" | "E" | "J" | "P" | "R" | "C" | "N"
  documentNumber?: string | null
}

export type SalesRange = "day" | "week" | "month" | "year"

// Location type
export type DeliveryLocation = {
  id?: string
  lat: number
  lng: number
  label?: string
  name?: string // User defined name (e.g. "Casa", "Trabajo")
  address?: string // Google Maps address / Street / Avenue
  villa?: string // Villa / Apt Name
  reference?: string // Reference Point
  source?: "gps" | "manual" | "saved" | "search"
  saved?: boolean
}

export type PickupLocation = {
  id: string
  description: string
  createdAt?: string
  updatedAt?: string
}

export type PaymentTicket = {
  id: number | string
  status: "pending" | "confirmed"
  createdAt: string
  confirmedAt?: string | null
  amount: number
  currency: string
  exchangeRate?: number | null
  exchangeRateDate?: string | null
  points: number
  items: { name: string; quantity: number; price: number; points?: number; productId?: string; noPointsByCoupon?: boolean; coveredUnits?: number; eligibleUnits?: number; pointsAwarded?: number }[]
  couponCode?: string | null
  couponId?: string | null
  discount?: number
  bank: string
  phone: string
  documentType: "V" | "E" | "J" | "P" | "R" | "C" | "N"
  documentNumber: string
  reference: string
  customerEmail?: string | null
  customerName?: string | null
  note?: string
  deliveryLocation?: DeliveryLocation
  saveLocationForFuture?: boolean
}

export type PaymentFormState = {
  bank: string
  phone: string
  documentType: PaymentTicket["documentType"]
  documentNumber: string
  reference: string
}

export type CajaState = {
  cartItems: SalesEvent[]
  appliedCoupon: CouponInspectResponse | null
  isRegisteredUser: boolean
}

export type Expense = {
  id: string
  description: string
  amount: number
  currency: string
  source?: string
  category: string
  occurredAt: string
  createdAt: string
  recordedBy?: { id: string; email?: string } | null
  exchangeRate?: number
  exchangeRateDate?: string | null
  paymentMethod?: string | null
}

export type CashClosureLine = {
  method: string
  expectedUsd: number
  expectedVes: number
  countedUsd: number
  countedVes: number
  diffUsd: number
  diffVes: number
  nativeCurrency: "USD" | "VES"
  hasActivity: boolean
  hasDifference: boolean
}

export type CashClosure = {
  id: string
  businessDate: string
  exchangeRate?: number | null
  expectedUsd: number
  expectedVes: number
  countedUsd: number
  countedVes: number
  diffUsd: number
  diffVes: number
  differenceCount: number
  lines?: CashClosureLine[] | null
  note?: string | null
  closedBy?: { id: string; email?: string; name?: string | null; role?: string } | null
  createdAt: string
}
