import { useCallback, useEffect, useMemo, useState, useRef, type RefObject, type Dispatch, type SetStateAction } from "react"
import {
   ShoppingBag,
   X,
   LogOut,
   User,
   Gamepad2,
   AlertCircle,
   ScanLine,
   Menu,
   Home,
} from "lucide-react"


// Components

import { ScannerSection } from "./client/components/ScannerSection"
import { LocationModal } from "./client/components/modals/LocationModal"
import { ProfileView } from "./client/components/ProfileView"
import { GamesView } from "./client/components/GamesView"
import { PaymentModal } from "./client/components/modals/PaymentModal"

import { OrderSection } from "./client/components/OrderSection"
import { LevelSection } from "./client/components/LevelSection"
import { RoadmapSection } from "./client/components/RoadmapSection"
import { WalletSection } from "./client/components/WalletSection"
import { HistorySection } from "./client/components/HistorySection"
import { TicketStatusSection } from "./client/components/TicketStatusSection"
import { DigitalCard } from "./client/components/DigitalCard"

import WelcomeModal from "./client/components/modals/WelcomeModal"
import FirstCouponModal from "./client/components/modals/FirstCouponModal"
import { GiftModal } from "./client/components/modals/GiftModal"
import GiftReceivedModal from "./client/components/modals/GiftReceivedModal"
import { RedeemModal } from "./client/components/modals/RedeemModal"
import { LevelBenefitsModal } from "./client/components/modals/LevelBenefitsModal"
import { TicketDetailModal } from "./client/components/modals/TicketDetailModal"

import type { LoyaltyRulesResponse, LevelDefinition } from "../types/loyalty"
import type { AuthUser, CouponDto, UserCouponsState, UserLevelState } from "../types/userState"
import type { CouponActivity, DeliveryLocation, PaymentFormState, PaymentTicket, PendingSale, ProductDef, ScannedProduct, ScannerState } from "../types/app"
import { getCouponCoverageByItem } from "./client/utils"
import { API_URL } from "../api/config"
import { formatPhoneNumber } from "../utils/format"
import { formatExchangeRateLabel, formatVesFromUsd, roundUsd } from "../utils/currency"



// --- Tipos e Interfaces (LÓGICA INTACTA) ---
type LatLngLiteral = { lat: number; lng: number }
type ClaimFormState = { code: string; status: string }

type ClientInterfaceProps = {
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
   onLoadMoreTickets?: () => void
   ticketsHasMore?: boolean
   ticketsInitialLoading?: boolean
   ticketsLoadError?: string | null
   ticketsLoadingMore?: boolean
   onLogout: () => void
   onUpdateProfile: (data: { phone?: string; cedula?: string; name?: string; hasSeenWelcome?: boolean; hasSeenFirstCoupon?: boolean; lastGiftSeenAt?: string | null }) => Promise<void>
   onCancelTicket: (id: number) => Promise<void>
   dailyRate: number
}

type CartItem = {
   id: string
   name: string
   price: number
   points: number
   quantity: number
   imageUrl?: string
}






type ActivityItem =
   | (PendingSale & { type: "pending" })
   | (ScannedProduct & { type: "confirmed" })
   | (CouponActivity & { type: "coupon"; activityType?: string })
   | (PaymentTicket & { type: "ticket" })

const getActivityDate = (item: ActivityItem) =>
   item.type === "pending"
      ? item.createdAt
      : item.type === "coupon"
         ? item.at
         : item.type === "ticket"
            ? item.createdAt
            : item.scannedAt

const activityTime = (item: ActivityItem) => {
   const dateValue = getActivityDate(item)
   const ts = dateValue ? new Date(dateValue).getTime() : NaN
   return Number.isFinite(ts) ? ts : 0
}

const hashString = (value: string) => {
   let hash = 0
   for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i)
      hash |= 0
   }
   return Math.abs(hash)
}

const isProductAvailable = (product: ProductDef) =>
   product.available ?? (product.active !== false && (product.stock ?? 1) > 0)

const HISTORY_LAST_SEEN_KEY_PREFIX = "history-last-seen"
const HISTORY_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

const getHistoryLastSeenStorageKey = (userId?: string | number | null) => {
   const scopedUser = userId !== undefined && userId !== null && String(userId).trim() !== ""
      ? String(userId)
      : "guest"
   return `${HISTORY_LAST_SEEN_KEY_PREFIX}:${scopedUser}`
}

const parseSeenTimestamp = (raw: string | null) => {
   const parsed = Number(raw || "0")
   return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const readHistoryLastSeen = (storageKey: string) => {
   if (typeof window === "undefined") return 0
   const scopedSeen = parseSeenTimestamp(localStorage.getItem(storageKey))
   if (scopedSeen > 0) return scopedSeen
   return parseSeenTimestamp(localStorage.getItem(HISTORY_LAST_SEEN_KEY_PREFIX))
}

const clampActivitySeenTs = (value: number, nowMs: number) => {
   if (!Number.isFinite(value) || value <= 0) return 0
   return Math.min(value, nowMs + HISTORY_MAX_CLOCK_SKEW_MS)
}

// --- Componente Principal ---
export default function ClientInterface(props: ClientInterfaceProps) {
   const {
      user,
      currentState,
      levelState,
      punchSlots,
      punchesFilled,
      showRewardAnimation,
      punchPopVersion,
      claimScanner,
      setClaimScanner,
      claimForm,
      setClaimForm,
      scannedProduct,
      setScannedProduct,
      loadingAction,
      onConfirmScannedProduct,
      stageScannedProduct,
      claimVideoRef,
      redeemModal,
      setRedeemModal,
      coupons,
      formatCouponSubtitle,
      getCouponStatusLabel,
      openRedeemModal,
      onGiftCoupon,
      giftingCouponId,
      confirmedHistory,
      couponEvents,
      pendingPurchases,
      showPendingNotice,
      onDismissPendingNotice,
      ladder,
      levelLadder,
      catalog,
      onCreateTicket,
      paymentTickets,
      onLoadMoreTickets,
      ticketsHasMore,
      ticketsInitialLoading,
      ticketsLoadError,
      ticketsLoadingMore,
      onCancelTicket,
      dailyRate,
      nextReward,
      onUpdateProfile,
   } = props

   const [showBenefits, setShowBenefits] = useState(false)
   const [giftModal, setGiftModal] = useState<{ active: boolean; coupon: CouponDto | null }>({
      active: false,
      coupon: null,
   })
   const [giftEmail, setGiftEmail] = useState("")
   const [giftStatus, setGiftStatus] = useState("")
   const [giftLoading, setGiftLoading] = useState(false)
   const [giftSuccess, setGiftSuccess] = useState(false)
   const [giftReceivedModal, setGiftReceivedModal] = useState<{ active: boolean; activity: CouponActivity | null }>({
      active: false,
      activity: null,
   })
   const [localGiftEvents, setLocalGiftEvents] = useState<CouponActivity[]>([])
   const couponSnapshotRef = useRef<string[]>([])
   const couponSnapshotLoadedRef = useRef(false)
   const seenCouponsRef = useRef<Set<string>>(new Set())
   const giftSeenOverrideRef = useRef(0)

   // --- Business Status Logic (Ported from GuestInterface) ---
   const [businessStatus, setBusinessStatus] = useState({ startHour: "13:00", endHour: "21:00", isForcedClosed: false })

   useEffect(() => {
      const fetchStatus = () => {
         fetch(`${API_URL}/loyalty/public/business-status?t=${Date.now()}`)
            .then(res => res.json())
            .then(setBusinessStatus)
            .catch(console.error)
      }
      fetchStatus()
      const interval = setInterval(fetchStatus, 30000)
      return () => clearInterval(interval)
   }, [])

   const isOpen = useMemo(() => {
      if (businessStatus.isForcedClosed) return false
      const now = new Date()
      const currentTime = now.getHours() * 60 + now.getMinutes()

      const [startH, startM] = businessStatus.startHour.split(':').map(Number)
      const [endH, endM] = businessStatus.endHour.split(':').map(Number)

      const startTime = startH * 60 + startM
      const endTime = endH * 60 + endM

      if (endTime > startTime) {
         // Normal case: Opening and closing on the same day
         return currentTime >= startTime && currentTime < endTime
      } else {
         // Midnight crossing case: (e.g., 1PM to 2AM)
         return currentTime >= startTime || currentTime < endTime
      }
   }, [businessStatus])




   // Notification Logic: persistent "Last Seen" timestamp scoped per user
   const historyLastSeenStorageKey = useMemo(
      () => getHistoryLastSeenStorageKey(user?.id),
      [user?.id],
   )
   const [historyLastSeen, setHistoryLastSeen] = useState(() => {
      return readHistoryLastSeen(getHistoryLastSeenStorageKey(user?.id))
   })

   useEffect(() => {
      setHistoryLastSeen(readHistoryLastSeen(historyLastSeenStorageKey))
   }, [historyLastSeenStorageKey])



   // --- Welcome & First Coupon Modals Logic ---
   const [welcomeModalOpen, setWelcomeModalOpen] = useState(false)
   const [firstCouponModalShow, setFirstCouponModalShow] = useState<{ active: boolean; coupon: CouponDto | null }>({ active: false, coupon: null })

   useEffect(() => {
      // Logic for Welcome Modal
      if (user?.id) {
         if (!user.hasSeenWelcome) {
            // Also check local storage as fallback/redundancy during session
            const hasSeenLocal = localStorage.getItem(`welcome_seen:${user.id}`)
            if (!hasSeenLocal) {
               setWelcomeModalOpen(true)
            }
         }
      }

      // Logic for First Coupon
      if (user?.id && coupons.length > 0) {
         if (!user.hasSeenFirstCoupon) {
            const hasSeenLocal = localStorage.getItem(`first_coupon_seen:${user.id}`)
            if (!hasSeenLocal) {
               // Find a valid coupon to show
               const valid = coupons.find(c => c.status === "available")
               if (valid) {
                  setFirstCouponModalShow({ active: true, coupon: valid })
               }
            }
         }
      }
   }, [user?.id, coupons.length]) // Depend on coupons length to trigger when they load

   const handleCloseWelcome = () => {
      setWelcomeModalOpen(false)
      if (user?.id) {
         localStorage.setItem(`welcome_seen:${user.id}`, "true")
         onUpdateProfile({ hasSeenWelcome: true })
      }
   }

   const handleCloseFirstCoupon = () => {
      setFirstCouponModalShow({ active: false, coupon: null })
      if (user?.id) {
         localStorage.setItem(`first_coupon_seen:${user.id}`, "true")
         onUpdateProfile({ hasSeenFirstCoupon: true })
      }
   }

   useEffect(() => {
      if (typeof window === "undefined") return
      if (!user?.id) {
         setLocalGiftEvents([])
         couponSnapshotRef.current = []
         couponSnapshotLoadedRef.current = false
         seenCouponsRef.current = new Set()
         return
      }

      const eventsKey = `gift_received_events:${user.id}`
      const snapshotKey = `coupon_owned_snapshot:${user.id}`
      const seenKey = `coupon_seen_ids:${user.id}`

      let parsedEvents: CouponActivity[] = []
      try {
         const rawEvents = localStorage.getItem(eventsKey)
         if (rawEvents) {
            const parsed = JSON.parse(rawEvents)
            if (Array.isArray(parsed)) parsedEvents = parsed
         }
      } catch { }

      let parsedSnapshot: string[] = []
      const rawSnapshot = localStorage.getItem(snapshotKey)
      if (rawSnapshot) {
         try {
            const parsed = JSON.parse(rawSnapshot)
            if (Array.isArray(parsed)) parsedSnapshot = parsed.filter((id) => typeof id === "string")
         } catch { }
      }

      let parsedSeen: string[] = []
      const rawSeen = localStorage.getItem(seenKey)
      if (rawSeen) {
         try {
            const parsed = JSON.parse(rawSeen)
            if (Array.isArray(parsed)) parsedSeen = parsed.filter((id) => typeof id === "string")
         } catch { }
      } else if (parsedSnapshot.length) {
         parsedSeen = parsedSnapshot
      }

      setLocalGiftEvents(parsedEvents)
      couponSnapshotRef.current = parsedSnapshot
      couponSnapshotLoadedRef.current = rawSnapshot !== null
      seenCouponsRef.current = new Set(parsedSeen)
      giftSeenOverrideRef.current = 0
   }, [user?.id])

   useEffect(() => {
      if (typeof window === "undefined") return
      if (!user?.id) return
      const eventsKey = `gift_received_events:${user.id}`
      localStorage.setItem(eventsKey, JSON.stringify(localGiftEvents))
   }, [localGiftEvents, user?.id])

   useEffect(() => {
      if (typeof window === "undefined") return
      if (!user?.id) return

      const snapshotKey = `coupon_owned_snapshot:${user.id}`
      const seenKey = `coupon_seen_ids:${user.id}`

      const currentIds = coupons.map((coupon) => coupon.id)
      const prevIds = couponSnapshotRef.current
      const prevSet = new Set(prevIds)
      const addedCoupons = coupons.filter((coupon) => !prevSet.has(coupon.id))

      const receiveIds = new Set(
         couponEvents
            .filter((item) => item.activityType === "RECEIVE" || (item.direction === "in" && item.peer))
            .map((item) => item.couponId),
      )

      if (couponSnapshotLoadedRef.current && addedCoupons.length) {
         const nowIso = new Date().toISOString()
         const newGiftEvents: CouponActivity[] = []

         addedCoupons.forEach((coupon) => {
            if (!seenCouponsRef.current.has(coupon.id)) return
            if (receiveIds.has(coupon.id)) return

            newGiftEvents.push({
               couponId: coupon.id,
               title: coupon.title || "Cupon",
               kind: coupon.kind,
               status: "available",
               direction: "in",
               peer: null,
               at: nowIso,
               activityType: "RECEIVE",
            })
         })

         if (newGiftEvents.length) {
            setLocalGiftEvents((prev) => [...newGiftEvents, ...prev].slice(0, 60))
         }
      }

      currentIds.forEach((id) => seenCouponsRef.current.add(id))
      localStorage.setItem(seenKey, JSON.stringify(Array.from(seenCouponsRef.current)))
      localStorage.setItem(snapshotKey, JSON.stringify(currentIds))
      couponSnapshotRef.current = currentIds
      couponSnapshotLoadedRef.current = true
   }, [coupons, couponEvents, user?.id])

   const mergedCouponEvents = useMemo(() => {
      if (!localGiftEvents.length) return couponEvents
      return [...localGiftEvents, ...couponEvents]
   }, [couponEvents, localGiftEvents])

   useEffect(() => {
      if (!user?.id || giftReceivedModal.active) return
      if (typeof window === "undefined") return
      if (!mergedCouponEvents.length) return

      const lastSeenAt = user?.lastGiftSeenAt ? new Date(user.lastGiftSeenAt).getTime() : 0
      const lastSeen = Math.max(Number.isFinite(lastSeenAt) ? lastSeenAt : 0, giftSeenOverrideRef.current)

      const receivedGifts = mergedCouponEvents.filter((item) =>
         item.activityType === "RECEIVE" || (item.direction === "in" && item.peer)
      )
      if (!receivedGifts.length) return

      const latestGift = receivedGifts
         .map((item) => ({ item, ts: new Date(item.at).getTime() }))
         .filter((entry) => Number.isFinite(entry.ts))
         .sort((a, b) => b.ts - a.ts)[0]

      if (!latestGift || latestGift.ts <= lastSeen) return
      setGiftReceivedModal({ active: true, activity: latestGift.item })
   }, [mergedCouponEvents, giftReceivedModal.active, user?.id, user?.lastGiftSeenAt])

   // --- Profile State (Hoisted for buildPaymentDefaults) ---
   const [profilePhone, setProfilePhone] = useState("")
   const [savedPhones, setSavedPhones] = useState<string[]>([])
   const [locationModal, setLocationModal] = useState<{ active: boolean; location: DeliveryLocation | null }>({ active: false, location: null })

   const normalizePhone = useCallback((value: string) => value.replace(/\D/g, ""), [])

   useEffect(() => {
      let rawDefault = ""

      if (user?.phoneNumber) {
         rawDefault = user.phoneNumber
      } else if (user?.id) {
         rawDefault = localStorage.getItem(`profile_phone:${user.id}`) || ""
      } else {
         rawDefault = localStorage.getItem("profile_phone") || ""
      }

      const formattedDefault = rawDefault ? formatPhoneNumber(rawDefault) : ""
      setProfilePhone(formattedDefault)

      if (typeof window === "undefined") {
         setSavedPhones(formattedDefault ? [formattedDefault] : [])
         return
      }

      const listKey = user?.id ? `profile_phone_list:${user.id}` : "profile_phone_list:guest"
      let storedList: string[] = []
      try {
         const rawList = localStorage.getItem(listKey)
         if (rawList) {
            const parsed = JSON.parse(rawList)
            if (Array.isArray(parsed)) storedList = parsed
         }
      } catch { }

      const merged = [formattedDefault, ...storedList]
         .map((phone) => formatPhoneNumber(phone))
         .filter((phone) => normalizePhone(phone))

      const unique: string[] = []
      const seen = new Set<string>()
      merged.forEach((phone) => {
         const key = normalizePhone(phone)
         if (!key || seen.has(key)) return
         seen.add(key)
         unique.push(phone)
      })

      setSavedPhones(unique)
   }, [user, normalizePhone])

   useEffect(() => {
      if (typeof window === "undefined") return
      const listKey = user?.id ? `profile_phone_list:${user.id}` : "profile_phone_list:guest"
      if (!savedPhones.length) {
         localStorage.removeItem(listKey)
         return
      }
      localStorage.setItem(listKey, JSON.stringify(savedPhones))
   }, [savedPhones, user?.id])

   // --- Cedula State ---
   const [profileCedula, setProfileCedula] = useState("")

   useEffect(() => {
      // Initialize cedula from user data if available
      if (user?.cedula) {
         setProfileCedula(user.cedula)
         return
      }

      // If user is logged in, check user-specific storage
      if (user?.id) {
         const scoped = localStorage.getItem(`profile_cedula:${user.id}`)
         if (scoped) {
            setProfileCedula(scoped)
         } else {
            setProfileCedula("")
         }
         return
      }

      // Guest fallback
      const storedCedula = localStorage.getItem("profile_cedula")
      if (storedCedula) setProfileCedula(storedCedula)
   }, [user])

   // --- Name State ---
   const [profileName, setProfileName] = useState("")

   useEffect(() => {
      if ((user as any)?.name) {
         setProfileName((user as any).name)
         return
      }
      if (user?.id) {
         const scoped = localStorage.getItem(`profile_name:${user.id}`)
         if (scoped) setProfileName(scoped)
         return
      }
      const stored = localStorage.getItem("profile_name")
      if (stored) setProfileName(stored)
   }, [user])

   const buildPaymentDefaults = (): PaymentFormState => ({
      bank: "Bancamiga (0172)",
      phone: profilePhone || "",
      documentType: "V" as PaymentTicket["documentType"],
      documentNumber: profileCedula || "",
      reference: "",
   })

   const [orderView, setOrderView] = useState(false)
   const [cartOpen, setCartOpen] = useState(false)
   const [cartItems, setCartItems] = useState<CartItem[]>(() => {
      // Load from local storage initially to avoid flicker if doing it in useEffect
      if (typeof window !== "undefined") {
         try {
            const saved = localStorage.getItem("cart_persistence")
            return saved ? JSON.parse(saved) : []
         } catch (e) {
            console.error("Error loading cart", e)
         }
      }
      return []
   })
   const [orderStatus, setOrderStatus] = useState("")
   const [paymentModal, setPaymentModal] = useState(false)
   const paymentModalOpenRef = useRef(false)
   const [paymentLoading, setPaymentLoading] = useState(false)
   const [paymentForm, setPaymentForm] = useState(buildPaymentDefaults)
   const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery")
   const [pendingOrderSubmission, setPendingOrderSubmission] = useState(false)

   // --- Coupon State ---
   const [selectedCoupon, setSelectedCoupon] = useState<CouponDto | null>(null)
   const [openTicket, setOpenTicket] = useState<PaymentTicket | null>(null)

   const couponCoverage = useMemo(
      () => getCouponCoverageByItem(cartItems, selectedCoupon),
      [cartItems, selectedCoupon],
   )
   const couponBlockedCount = useMemo(
      () => couponCoverage.reduce((sum, covered) => sum + (covered > 0 ? 1 : 0), 0),
      [couponCoverage],
   )


   const cartTotals = useMemo(() => {
      const totals = cartItems.reduce(
         (acc, item, index) => {
            const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
            const price = roundUsd(item.price ?? 0)
            const rawPoints = Number(item.points ?? 0)
            const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
            const coveredUnits = Math.max(0, Math.min(quantity, Number(couponCoverage[index] ?? 0) || 0))
            const eligibleUnits = Math.max(0, quantity - coveredUnits)
            acc.items += quantity
            acc.total += price * quantity
            acc.points += pointsPerUnit * eligibleUnits
            return acc
         },
         { items: 0, total: 0, points: 0 }
      )
      const safeTotal = Number.isFinite(totals.total) ? totals.total : 0
      const safePoints = Number.isFinite(totals.points) ? Math.max(0, totals.points) : 0
      return { ...totals, total: safeTotal, points: safePoints }
   }, [cartItems, couponCoverage])

   const cartItemsForTicket = useMemo(
      () =>
         cartItems.map((item, index) => {
            const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
            const coveredUnits = Math.max(0, Math.min(quantity, Number(couponCoverage[index] ?? 0) || 0))
            const eligibleUnits = Math.max(0, quantity - coveredUnits)
            const rawPoints = Number(item.points ?? 0)
            const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
            const pointsAwarded = pointsPerUnit * eligibleUnits
            const noPointsByCoupon = coveredUnits > 0 && eligibleUnits === 0
            return {
               name: item.name,
               quantity,
               price: roundUsd(item.price),
               points: pointsPerUnit,
               productId: item.id,
               coveredUnits,
               eligibleUnits,
               pointsAwarded,
               ...(noPointsByCoupon ? { noPointsByCoupon: true } : {}),
            }
         }),
      [cartItems, couponCoverage],
   )

   // Persist Cart
   useEffect(() => {
      localStorage.setItem("cart_persistence", JSON.stringify(cartItems))
   }, [cartItems])

   const couponDiscount = useMemo(() => {
      if (!selectedCoupon) return 0
      const subtotal = cartTotals.total
      if (!Number.isFinite(subtotal) || subtotal <= 0) return 0

      const capValue = Number(selectedCoupon.capUsd ?? NaN)
      const cap = Number.isFinite(capValue) && capValue > 0 ? capValue : null
      const clamp = (value: number) => Math.min(subtotal, Math.max(0, value))
      const applyCap = (value: number) => (cap ? Math.min(value, cap) : value)

      if (selectedCoupon.kind === "percent") {
         const percent = Number(selectedCoupon.value ?? 0)
         if (!Number.isFinite(percent) || percent <= 0) return 0
         return clamp(roundUsd(applyCap((subtotal * percent) / 100)))
      }

      if (selectedCoupon.kind === "free-item" || selectedCoupon.kind === "combo") {
         if (cap) {
            return clamp(roundUsd(Math.min(subtotal, cap)))
         }
         const prices = cartItems
            .map((item) => Number(item.price ?? 0))
            .filter((price) => Number.isFinite(price) && price > 0)
         if (!prices.length) return 0
         const maxPrice = Math.max(...prices)
         return clamp(roundUsd(maxPrice))
      }

      if (selectedCoupon.kind === "bogo") {
         const prices = cartItems
            .map((item) => Number(item.price ?? 0))
            .filter((price) => Number.isFinite(price) && price > 0)
         const totalUnits = cartItems.reduce((sum, item) => sum + Math.max(0, item.quantity || 0), 0)
         if (totalUnits < 2 || !prices.length) return 0
         const minPrice = Math.min(...prices)
         return clamp(roundUsd(applyCap(minPrice)))
      }

      const value = Number(selectedCoupon.value ?? 0)
      if (!Number.isFinite(value) || value <= 0) return 0
      return clamp(roundUsd(applyCap(value)))
   }, [selectedCoupon, cartTotals.total, cartItems])

   const finalTotal = Math.max(0, roundUsd(cartTotals.total - couponDiscount))

   useEffect(() => {
      if (!selectedCoupon) return
      const stillAvailable = coupons.some((coupon) => coupon.id === selectedCoupon.id && coupon.status === "available")
      if (!stillAvailable) setSelectedCoupon(null)
   }, [coupons, selectedCoupon])

   const loadStoredLocations = useCallback(async (): Promise<DeliveryLocation[]> => {
      if (!user?.id) {
         // Guest mode
         if (typeof window === "undefined") return []
         try {
            const listKey = "delivery-locations-list:guest"
            const rawList = localStorage.getItem(listKey)
            if (rawList) {
               const parsed = JSON.parse(rawList)
               if (Array.isArray(parsed)) return parsed
            }
         } catch { }
         return []
      }

      try {
         const token = (user as any).token || JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
         const res = await fetch(`${API_URL}/loyalty/locations`, {
            headers: { Authorization: `Bearer ${token}` }
         })
         if (res.ok) {
            const data = await res.json()
            return data.map((l: any) => ({
               id: l.id, // Keep ID for deletion
               lat: l.lat,
               lng: l.lng,
               name: l.name,
               address: l.address,
               villa: l.villa,
               reference: l.reference,
               source: l.source,
               saved: true
            }))
         }
      } catch (err) {
         console.error("Error loading locations", err)
      }
      return []
   }, [user?.id])

   const persistLocation = useCallback(
      async (loc: DeliveryLocation) => {
         if (!user?.id) {
            // Guest logic
            if (typeof window === "undefined") return
            const listKey = "delivery-locations-list:guest"
            const newLoc = { ...loc, saved: true, source: "saved" as const }
            let currentList: DeliveryLocation[] = []
            try {
               const raw = localStorage.getItem(listKey)
               if (raw) currentList = JSON.parse(raw)
            } catch { }
            const filtered = currentList.filter(l =>
               Math.abs(l.lat - loc.lat) > 0.0001 || Math.abs(l.lng - loc.lng) > 0.0001
            )
            const updated = [newLoc, ...filtered].slice(0, 5)
            localStorage.setItem(listKey, JSON.stringify(updated))
            return updated
         }

         // Logged in: API
         try {
            const token = (user as any).token || JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            const res = await fetch(`${API_URL}/loyalty/locations`, {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
               },
               body: JSON.stringify(loc)
            })
            if (res.ok) {
               await res.json()
               const updatedList = await loadStoredLocations()
               setSavedLocations(updatedList)
               return updatedList
            }
         } catch (e) {
            console.error("Error saving location", e)
         }
      },
      [user?.id, loadStoredLocations],
   )
   const [savedLocations, setSavedLocations] = useState<DeliveryLocation[]>([])
   const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation | null>(null)
   const [saveLocationPreference, setSaveLocationPreference] = useState(false)

   const [isMenuOpen, setIsMenuOpen] = useState(false)
   const [currentView, setCurrentView] = useState<"home" | "profile" | "games">("home")

   const handleSaveProfilePhone = async (phone: string) => {
      const formatted = formatPhoneNumber(phone)
      const normalized = normalizePhone(formatted)

      setProfilePhone(formatted)
      if (normalized) {
         setSavedPhones((prev) => {
            const filtered = prev.filter((item) => normalizePhone(item) !== normalized)
            return [formatted, ...filtered]
         })
      }
      if (user?.id) {
         await props.onUpdateProfile({ phone: formatted })
         localStorage.setItem(`profile_phone:${user.id}`, formatted)
      } else {
         localStorage.setItem("profile_phone", formatted)
      }
   }

   const rememberPhoneFromOrder = useCallback(
      (phone: string) => {
         const formatted = formatPhoneNumber(phone)
         const normalized = normalizePhone(formatted)
         if (!normalized) return

         if (normalizePhone(profilePhone) === normalized) {
            setSavedPhones((prev) => {
               const filtered = prev.filter((item) => normalizePhone(item) !== normalized)
               return [formatted, ...filtered]
            })
            return
         }

         handleSaveProfilePhone(formatted).catch((err) => {
            console.error("Error updating profile phone", err)
         })
      },
      [handleSaveProfilePhone, normalizePhone, profilePhone],
   )

   const handleSaveProfileCedula = async (cedula: string) => {
      setProfileCedula(cedula)
      if (user?.id) {
         try {
            await props.onUpdateProfile({ cedula })
            localStorage.setItem(`profile_cedula:${user.id}`, cedula)
         } catch (e: any) {
            // Rethrow to allow component to handle UI
            throw e
         }
      } else {
         localStorage.setItem("profile_cedula", cedula)
      }
   }

   const handleSaveProfileName = async (name: string) => {
      setProfileName(name)
      if (user?.id) {
         await props.onUpdateProfile({ name })
         localStorage.setItem(`profile_name:${user.id}`, name)
      } else {
         localStorage.setItem("profile_name", name)
      }
   }

   const handleDeleteLocation = async (index: number) => {
      const target = savedLocations[index]
      if (!target) return

      // Optimistic update
      const newList = [...savedLocations]
      newList.splice(index, 1)
      setSavedLocations(newList)

      if (user?.id && target.id) {
         try {
            const token = (user as any).token || JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            await fetch(`${API_URL}/loyalty/locations/${target.id}`, {
               method: "DELETE",
               headers: { Authorization: `Bearer ${token}` }
            })
         } catch (e) {
            console.error("Error deleting location", e)
            // Revert if failed? For now keep optimistic.
         }
      } else {
         // Guest
         const listKey = "delivery-locations-list:guest"
         localStorage.setItem(listKey, JSON.stringify(newList))
      }
   }

   const handleSetDefaultLocation = async (index: number) => {
      if (index === 0) return
      const target = savedLocations[index]
      if (!target) return

      // Optimistic update
      const newList = [...savedLocations]
      const [moved] = newList.splice(index, 1)
      newList.unshift(moved)
      setSavedLocations(newList)

      if (user?.id && target.id) {
         try {
            const token = (user as any).token || JSON.parse(localStorage.getItem("loyalty-auth") || "{}").token
            await fetch(`${API_URL}/loyalty/locations/${target.id}/default`, {
               method: "PATCH",
               headers: { Authorization: `Bearer ${token}` }
            })
         } catch (e) {
            console.error("Error setting default location", e)
         }
      } else {
         // Guest
         const listKey = "delivery-locations-list:guest"
         localStorage.setItem(listKey, JSON.stringify(newList))
      }
   }

   // handleSaveNewLocation definition moved down to access submit logic

   const ticketBuckets = useMemo(() => {
      const now = Date.now()
      const twentyFourHours = 24 * 60 * 60 * 1000
      const pending = paymentTickets.filter(t => t.status === "pending" && (now - new Date(t.createdAt).getTime()) < twentyFourHours).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const confirmed = paymentTickets.filter(t => t.status === "confirmed").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      return {
         pending,
         confirmed,
      }
   }, [paymentTickets])
   useEffect(() => {
      loadStoredLocations().then(stored => {
         setSavedLocations(stored)
         setSaveLocationPreference(false)
         if (stored.length > 0) {
            setSelectedLocation(stored[0])
         }
      })
   }, [loadStoredLocations])

   const menuProducts = useMemo<ProductDef[]>(() => {
      const available = (catalog || []).filter((item) => Boolean(item?.name) && item.active !== false)
      return available.length ? available : []
   }, [catalog])

   useEffect(() => {
      if (!paymentModal) return
      if (savedLocations.length > 0 && !selectedLocation) {
         setSelectedLocation(savedLocations[0])

      }
   }, [paymentModal, savedLocations, selectedLocation])

   useEffect(() => {
      if (!paymentModal) {
         paymentModalOpenRef.current = false
         return
      }
      if (paymentModalOpenRef.current) return
      paymentModalOpenRef.current = true
      const defaultPhone = profilePhone || savedPhones[0] || ""
      if (!defaultPhone) return
      setPaymentForm((prev) => ({ ...prev, phone: defaultPhone }))
   }, [paymentModal, profilePhone, savedPhones])

   const resolveProductKey = useCallback((product: ProductDef) => product.id || product.name, [])
   const normalizeProductKey = useCallback((value: string) => value.trim().toLowerCase(), [])

   const productMetaByKey = useMemo(() => {
      const map = new Map<string, { imageUrl?: string; price: number; points: number; available: boolean }>()
      menuProducts.forEach((product) => {
         const meta = {
            imageUrl: product.imageUrl,
            price: roundUsd(product.price ?? 0),
            points: Number(product.points ?? 0),
            available: isProductAvailable(product),
         }
         const idKey = resolveProductKey(product)
         map.set(normalizeProductKey(idKey), meta)
         map.set(normalizeProductKey(product.name), meta)
      })
      return map
   }, [menuProducts, resolveProductKey, normalizeProductKey])

   useEffect(() => {
      if (!cartItems.length || productMetaByKey.size === 0) return
      setCartItems((prev) => {
         let changed = false
         const next = prev.flatMap((item) => {
            const key = normalizeProductKey(item.id || item.name)
            const meta =
               productMetaByKey.get(key) ?? productMetaByKey.get(normalizeProductKey(item.name))
            if (!meta || !meta.available) {
               changed = true
               return []
            }
            let nextItem = item
            if (meta.imageUrl && meta.imageUrl !== item.imageUrl) {
               nextItem = { ...nextItem, imageUrl: meta.imageUrl }
            }
            if (Number.isFinite(meta.price) && meta.price !== Number(item.price ?? 0)) {
               nextItem = { ...nextItem, price: meta.price }
            }
            if (Number.isFinite(meta.points) && meta.points !== Number(item.points ?? 0)) {
               nextItem = { ...nextItem, points: meta.points }
            }
            if (nextItem !== item) changed = true
            return [nextItem]
         })
         return changed ? next : prev
      })
   }, [cartItems.length, productMetaByKey, normalizeProductKey])

   const updateCartQuantity = useCallback(
      (product: ProductDef, delta: number) => {
         if (!delta) return
         if (delta > 0 && !isProductAvailable(product)) return
         const id = resolveProductKey(product)
         const price = roundUsd(product.price ?? 0)
         const points = Number(product.points ?? 0)

         setCartItems((prev) => {
            const current = prev.find((item) => item.id === id)
            if (!current && delta < 0) return prev
            if (current) {
               const nextQty = current.quantity + delta
               if (nextQty <= 0) return prev.filter((item) => item.id !== id)
               return prev.map((item) => (item.id === id ? { ...item, quantity: nextQty } : item))
            }
            return [...prev, { id, name: product.name, price, points, quantity: 1, imageUrl: product.imageUrl }]
         })
         setOrderStatus("")
      },
      [resolveProductKey],
   )

   const cartQuantities = useCallback(
      (product: ProductDef) => {
         const id = resolveProductKey(product)
         return cartItems.find((item) => item.id === id)?.quantity ?? 0
      },
      [cartItems, resolveProductKey],
   )


   const handleManualLocation = useCallback((coords: LatLngLiteral, source: DeliveryLocation["source"] = "manual") => {
      setSelectedLocation({ lat: coords.lat, lng: coords.lng, source })

   }, [])

   const handleUpdateLocation = useCallback((updates: Partial<DeliveryLocation>) => {
      setSelectedLocation((prev) => (prev ? { ...prev, ...updates } : null))
   }, [])

   const handleUseSavedLocation = useCallback((loc: DeliveryLocation) => {
      setSelectedLocation({ ...loc, source: "saved" })

   }, [])



   const formatPrice = useCallback((value: number) => {
      if (!Number.isFinite(value)) return "$0"
      const normalized = roundUsd(value)
      return normalized.toLocaleString("es-CO", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 2 })
   }, [])

   const clearCart = useCallback(() => {
      setCartItems([])
      setOrderStatus("")
      setSelectedCoupon(null)
   }, [])

   const handlePayCart = useCallback(() => {
      if (!cartItems.length) return
      setPaymentModal(true)
      setCartOpen(false)
   }, [cartItems.length])

   const closeOrderView = useCallback(() => {
      setOrderView(false)
      setCartOpen(false)
   }, [])

   const startOrderFlow = useCallback(() => {
      setOrderView(true)
      setCartOpen(false)
      setOrderStatus("")
   }, [])

   const handleUseCoupon = useCallback(
      (coupon: CouponDto) => {
         setSelectedCoupon(coupon)
         startOrderFlow()
      },
      [startOrderFlow],
   )

   const openCart = useCallback(() => setCartOpen(true), [])
   const toggleCart = useCallback(() => setCartOpen((prev) => !prev), [])
   const closePaymentModal = useCallback(() => setPaymentModal(false), [])
   const resetPaymentForm = useCallback(() => setPaymentForm(buildPaymentDefaults()), [])
   const openChat = useCallback((ticketId?: string | number) => {
      const base = "https://wa.me/584226301000"
      const formattedId = ticketId ? ticketId.toString().padStart(6, '0') : ""
      const msg = formattedId
         ? `¡Hola! Mi ticket es el #${formattedId} y quisiera saber el estado de mi pedido.`
         : "Hola, necesito ayuda con mi ticket de pago."
      const text = encodeURIComponent(msg)
      window.open(`${base}?text=${text}`, "_blank", "noopener,noreferrer")
   }, [])



   const processTicketCreation = useCallback(async (locationOverride?: DeliveryLocation, preOpenedWindow?: Window | null) => {
      console.log("processTicketCreation called", { locationOverride })

      try {
         const { phone, documentType, bank } = paymentForm
         const trimmedPhone = phone.trim()

         const rawCedula = ((user as any)?.cedula || profileCedula || "").toString().trim()
         const cedulaMatch = rawCedula.match(/^([VEJPRCN])\s*[-]?\s*(\d+)$/i)
         const resolvedDocType = (cedulaMatch?.[1]?.toUpperCase() as PaymentTicket["documentType"]) || documentType
         const resolvedDocNumber = cedulaMatch ? cedulaMatch[2] : rawCedula.replace(/\D/g, "")

         const finalReference = bank === "EFECTIVO" ? "EFECTIVO" : "PENDIENTE"
         const locationToUse = deliveryMethod === "delivery" ? (locationOverride || selectedLocation) : null

         // Use pre-opened window or try to open one (fallback for direct sync calls if checking logic fails)
         let whatsappWindow: Window | null = preOpenedWindow || null
         // Ticket creation logic follows...

         const ticketPayload: Omit<PaymentTicket, "id" | "status" | "createdAt" | "confirmedAt"> = {
            amount: finalTotal,
            currency: "USD",
            exchangeRate: dailyRate > 0 ? dailyRate : undefined,
            points: cartTotals.points,
            items: cartItemsForTicket,
            bank,
            phone: trimmedPhone,
            documentType: resolvedDocType,
            documentNumber: resolvedDocNumber,
            reference: finalReference,
            discount: couponDiscount,
            couponId: selectedCoupon?.id,
            deliveryLocation: locationToUse || undefined,
            saveLocationForFuture: saveLocationPreference
         }

         const result = await onCreateTicket(ticketPayload)

         if (!result || !result.id) {
            setOrderStatus("Error al generar el ticket. Inténtalo de nuevo.")
            whatsappWindow?.close()
            return
         }

         const lines = cartItems.map(i => `- ${i.quantity}x ${i.name}`).join("\n")
         const totalUsd = finalTotal.toFixed(2)
         const ticketExchangeRate = Number(result.exchangeRate ?? dailyRate)
         const totalVes = ticketExchangeRate > 0 ? formatVesFromUsd(finalTotal, ticketExchangeRate) : null

         const method = bank === "EFECTIVO" ? "Efectivo" : "Pago Móvil"
         const deliveryType = deliveryMethod === "pickup" ? "Retiro en Tienda" : "Delivery"
         const locReference = locationToUse?.reference || locationToUse?.address || "Ubicacion en mapa"
         const locDetail = locationToUse?.villa || ""
         const locLabel = [locReference, locDetail].filter(Boolean).join(" - ")
         const mapLink = locationToUse ? `https://www.google.com/maps/search/?api=1&query=${locationToUse.lat},${locationToUse.lng}` : null

         const parts = [
            "👋 *¡Hola! Realizo el siguiente pedido:*",
            "",
            "*Datos del Cliente:*",
            `Cliente: ${(user as any)?.name || (user as any)?.nombre || "Cliente"}`,
            `Cédula: ${(user as any)?.cedula || profileCedula || "No registrada"}`,
            `Teléfono: ${trimmedPhone}`,
            "",
            "*Detalle del Pedido:*",
            `Ticket #: ${result.id}`,
            "----------------",
            lines,
            "----------------",
            "",
            totalVes ? `Total: $${totalUsd} (Bs. ${totalVes})` : `Total: $${totalUsd}`,
            totalVes ? formatExchangeRateLabel(ticketExchangeRate) : null,
            `Pago: ${method}`,
            `Entrega: ${deliveryType}`,
            deliveryMethod === "delivery" ? `Dirección: ${locLabel} ${mapLink ? `(${mapLink})` : ''}` : null,
            "",
            "⚠️ *IMPORTANTE:* Por favor envía este mensaje sin editarlo. Contiene los detalles necesarios para procesar tu pedido."
         ]

         // Join with newlines, filtering out nulls
         const message = parts.filter(p => p !== null).join("\n")

         const whatsappUrl = `https://wa.me/584226301000?text=${encodeURIComponent(message)}`

         if (whatsappWindow) {
            whatsappWindow.location.href = whatsappUrl
         } else {
            // Use location.href for better deep linking on mobile
            window.location.href = whatsappUrl
         }

         if (saveLocationPreference && locationToUse && !locationToUse.saved) {
            persistLocation(locationToUse).then(updatedList => {
               if (updatedList) setSavedLocations(updatedList)
            })
         }

         if (trimmedPhone) {
            rememberPhoneFromOrder(trimmedPhone)
         }

         setOrderStatus("Ticket enviado, pendiente de confirmación")
         setPaymentModal(false)
         setCartOpen(false)
         setCartItems([])
         setSelectedCoupon(null)
         resetPaymentForm()
      } catch (error) {
         console.error("Error creating ticket", error)
         setOrderStatus("Error al generar el ticket. Inténtalo de nuevo.")
         // If we created a window but failed, close it
         // But we can't easily access whatsappWindow here if it was local var inside try
         // So we might leave it open (empty) or user closes it.
         // Effectively, the openWhatsAppWindow helper opens it. If we passed it in, we have ref?
         // No easy way to close it here if scope lost, but that's acceptable for edge case.
         if (preOpenedWindow) preOpenedWindow.close()
      } finally {
         setPaymentLoading(false)
      }
   }, [
      cartItems,
      cartItemsForTicket,
      cartTotals.points,
      cartTotals.total,
      onCreateTicket,
      paymentForm,
      resetPaymentForm,
      saveLocationPreference,
      selectedLocation,
      persistLocation,
      user,
      formatPrice,
      dailyRate,
      profileCedula,
      finalTotal,
      couponDiscount,
      selectedCoupon,
      deliveryMethod,
      rememberPhoneFromOrder
   ])

   const saveLocationHandler = useCallback(async (loc: DeliveryLocation) => {
      console.log("saveLocationHandler called", { loc, pendingOrderSubmission })

      // If we are about to submit an order, PRE-OPEN the window here (Sync user gesture)
      let win: Window | null = null
      // User requested to remove "Cargando WhatsApp" screen (pre-open).
      // We will open it at the end of processTicketCreation.
      // if (pendingOrderSubmission) {
      //    win = openWhatsAppWindow()
      // }

      const updatedList = await persistLocation(loc)
      if (updatedList) setSavedLocations(updatedList)
      setLocationModal({ active: false, location: null })
      if (pendingOrderSubmission) {
         setPendingOrderSubmission(false)
         await processTicketCreation(loc, win)
      }
   }, [persistLocation, pendingOrderSubmission, processTicketCreation])

   const handleSubmitPayment = useCallback(async () => {
      console.log("handleSubmitPayment called")
      console.log("State:", { cartItemsLength: cartItems.length, paymentForm, saveLocationPreference, selectedLocation })
      if (paymentLoading) return
      if (!cartItems.length) return
      const { phone } = paymentForm
      const trimmedPhone = phone.trim()
      if (!trimmedPhone) {
         setOrderStatus("Completa tu telefono para generar el ticket")
         setPaymentModal(true)
         return
      }

      const rawCedula = ((user as any)?.cedula || profileCedula || "").toString().trim()
      const resolvedDocNumber = rawCedula.replace(/\D/g, "")

      if (!resolvedDocNumber) {
         setOrderStatus("Completa tu cedula en el perfil para generar el ticket")
         setPaymentModal(true)
         return
      }

      if (deliveryMethod === "delivery" && !selectedLocation) {
         setOrderStatus("Selecciona una ubicacion de entrega para generar el ticket")
         setPaymentModal(true)
         return
      }

      if (deliveryMethod === "delivery" && saveLocationPreference && selectedLocation && !selectedLocation.saved) {
         // Check if location is fully defined (re-saving same loc manually)
         const isFullyDefined = selectedLocation.name && selectedLocation.villa && selectedLocation.reference
         if (isFullyDefined) {
            console.log("Silent save for location", selectedLocation)
            setPaymentLoading(true)

            // Pre-open window removed as per request
            // const win = openWhatsAppWindow()
            const win = null

            try {
               const updated = await persistLocation(selectedLocation)
               if (updated) setSavedLocations(updated)
               // IMPORTANT: Pass the location explicitly to processTicketCreation so it uses the 'saved' version logic if needed,
               // or simply rely on the fact we just saved it.
               await processTicketCreation({ ...selectedLocation, saved: true }, win)
            } catch (e) {
               console.error("Silent save failed", e)
               // Fallback to modal if save fails? Or just proceed without saving?
               // Proceeding without saving might be safer to not block order
               await processTicketCreation(selectedLocation, win)
            }
            return
         }

         console.log("Interrupting for Location Save", { selectedLocation })
         setPendingOrderSubmission(true)
         setLocationModal({ active: true, location: selectedLocation })
         return
      }

      // Direct submission
      setPaymentLoading(true)
      await processTicketCreation(undefined, null)
   }, [
      cartItems.length,
      paymentForm,
      user,
      profileCedula,
      paymentLoading,
      saveLocationPreference,
      selectedLocation,
      deliveryMethod,
      processTicketCreation
   ])

   const activityItems = useMemo<ActivityItem[]>(() => {
      // 1. Group Confirmed History
      const salesMap = new Map<string, ScannedProduct[]>()

      confirmedHistory.forEach((item, idx) => {
         // Skip ticket claims as they should appear in paymentTickets
         if (item.code?.startsWith("ticket://")) return

         const scannedTs = item.scannedAt ? new Date(item.scannedAt).getTime() : NaN
         const fallbackKey = item.code || item.productId || item.name || "item"
         const timeKey = Number.isFinite(scannedTs)
            ? item.scannedAt
            : `${fallbackKey}-${idx}`

         if (!salesMap.has(timeKey)) salesMap.set(timeKey, [])
         salesMap.get(timeKey)!.push(item)
      })

      // Convert grouped sales into Pseudo-Tickets
      const salesTickets: (PaymentTicket & { type: "ticket" })[] = Array.from(salesMap.entries()).map(([timeKey, items]) => {
         const first = items[0]
         const normalizedItems = items.map((item) => {
            const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
            const rawPoints = Number(item.points ?? 0)
            const pointsAwarded = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
            const pointsPerUnit = quantity ? pointsAwarded / quantity : pointsAwarded
            const safePointsPerUnit = Number.isFinite(pointsPerUnit) ? pointsPerUnit : 0
            return {
               name: item.name,
               quantity,
               price: Number(item.price ?? 0),
               points: safePointsPerUnit,
               pointsAwarded,
               eligibleUnits: quantity,
               coveredUnits: 0,
               productId: item.productId
            }
         })
         const total = normalizedItems.reduce((sum, i) => sum + (Number(i.price ?? 0) * (i.quantity ?? 1)), 0)
         const totalPoints = normalizedItems.reduce((sum, i) => sum + (Number(i.pointsAwarded ?? 0) || 0), 0)

         // Generate a shorter, friendlier ID based on timestamp (or a stable hash fallback)
         const ts = new Date(timeKey).getTime()
         const shortId = Number.isFinite(ts)
            ? `V-${ts.toString().slice(-8)}`
            : `V-${hashString(timeKey).toString().slice(-8)}`

         return {
            id: shortId as any,
            status: "confirmed",
            createdAt: timeKey,
            amount: total,
            currency: first.currency || "USD",
            points: totalPoints,
            items: normalizedItems,
            bank: "Caja",
            phone: "",
            documentType: "V",
            documentNumber: "",
            reference: "Venta en Tienda",
            type: "ticket"
         }
      })

      const ticketItems = [...ticketBuckets.pending, ...ticketBuckets.confirmed]

      const merged: ActivityItem[] = [
         ...pendingPurchases.map((item) => ({ ...item, type: "pending" as const })),
         ...salesTickets,
         ...mergedCouponEvents.map((item) => ({ ...item, type: "coupon" as const, activityType: (item as any).activityType })),
         ...ticketItems.map((item) => ({ ...item, type: "ticket" as const })),
      ]
      return merged.sort((a, b) => activityTime(b) - activityTime(a))
   }, [confirmedHistory, mergedCouponEvents, pendingPurchases, ticketBuckets.pending, ticketBuckets.confirmed])

   const latestActivitySeenTs = useMemo(() => {
      if (!activityItems.length) return 0
      const now = Date.now()
      return activityItems.reduce((maxTs, item) => {
         const ts = clampActivitySeenTs(activityTime(item), now)
         return ts > maxTs ? ts : maxTs
      }, 0)
   }, [activityItems])

   useEffect(() => {
      if (typeof window === "undefined") return
      if (currentView !== "home") return
      if (!Number.isFinite(latestActivitySeenTs) || latestActivitySeenTs <= 0) return

      const storedSeen = readHistoryLastSeen(historyLastSeenStorageKey)
      if (storedSeen >= latestActivitySeenTs) return

      localStorage.setItem(historyLastSeenStorageKey, String(latestActivitySeenTs))
   }, [currentView, historyLastSeenStorageKey, latestActivitySeenTs])

   const closeGiftModal = () => {
      setGiftModal({ active: false, coupon: null })
      setGiftEmail("")
      setGiftStatus("")
      setGiftLoading(false)
      setGiftSuccess(false)
   }

   const closeGiftReceivedModal = useCallback(() => {
      const giftAt = giftReceivedModal.activity?.at
      const ts = giftAt ? new Date(giftAt).getTime() : Date.now()
      if (Number.isFinite(ts)) {
         giftSeenOverrideRef.current = ts
      }
      const nextSeen = Number.isFinite(ts) ? new Date(ts).toISOString() : new Date().toISOString()
      onUpdateProfile({ lastGiftSeenAt: nextSeen })
      setGiftReceivedModal({ active: false, activity: null })
   }, [giftReceivedModal.activity, onUpdateProfile])

   const handleGiftSubmit = async () => {
      if (!giftModal.coupon) return
      const email = giftEmail.trim()
      if (!email || !email.includes("@")) {
         setGiftStatus("Ingresa un correo valido")
         return
      }
      setGiftLoading(true)
      setGiftStatus("") // Clear previous status

      const result = await onGiftCoupon(giftModal.coupon, email)

      if (result?.ok) {
         setGiftSuccess(true)
      } else {
         let errorMsg = result?.message || "No se pudo transferir"

         // Intentar parsear si parece ser un JSON string
         if (typeof errorMsg === 'string' && errorMsg.trim().startsWith('{')) {
            try {
               const parsed = JSON.parse(errorMsg)
               if (parsed.message) errorMsg = parsed.message
               else if (parsed.error) errorMsg = parsed.error
            } catch {
               // ignora error parseo
            }
         }

         if (typeof errorMsg === 'object') {
            try {
               errorMsg = (errorMsg as any).message || JSON.stringify(errorMsg)
            } catch {
               errorMsg = "Error desconocido"
            }
         }

         if (String(errorMsg).includes("[object Object]")) errorMsg = "Error de servidor"
         setGiftStatus(String(errorMsg))
      }
      setGiftLoading(false)
   }

   // --- Layout Principal ---
   return (
      <div className="relative min-h-screen w-full min-w-0 max-w-[100vw] overflow-x-hidden font-sans pb-32 lg:pb-20 selection:bg-[#1A864D]/20 selection:text-[#1A864D]">

         {/* Elemento decorativo de fondo sutil */}
         <div className="fixed top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-white/10 to-transparent z-0 pointer-events-none" />

         {/* Componentes Flotantes / Modales */}
         <ScannerSection
            claimScanner={claimScanner}
            setClaimScanner={setClaimScanner}
            scannedProduct={scannedProduct}
            setScannedProduct={setScannedProduct}
            claimForm={claimForm}
            setClaimForm={setClaimForm}
            loadingAction={loadingAction}
            onConfirmScannedProduct={onConfirmScannedProduct}
            stageScannedProduct={stageScannedProduct}
            claimVideoRef={claimVideoRef}
         />

         <OrderSection
            active={orderView}
            onClose={closeOrderView}
            products={menuProducts}
            cartItems={cartItems}
            cartTotals={cartTotals}
            pointsBlockedCount={couponBlockedCount}
            couponCoverage={couponCoverage}

            cartOpen={cartOpen}
            onOpenCart={openCart}
            onToggleCart={toggleCart}
            onChangeQuantity={updateCartQuantity}
            onClearCart={clearCart}
            onPay={handlePayCart}
            formatPrice={formatPrice}
            getQuantity={cartQuantities}
            exchangeRate={dailyRate}
            // Coupons
            availableCoupons={coupons.filter(c => c.status === "available")}
            selectedCoupon={selectedCoupon}
            onSelectCoupon={setSelectedCoupon}
            discountAmount={couponDiscount}
            finalTotal={finalTotal}
            isClosed={!isOpen}
         />

         <PaymentModal
            error={orderStatus}
            open={paymentModal}
            onClose={closePaymentModal}
            amount={finalTotal}
            points={cartTotals.points}
            currency="USD"
            paymentForm={paymentForm}
            onChange={setPaymentForm}
            onSubmit={handleSubmitPayment}
            formatPrice={formatPrice}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            selectedLocation={selectedLocation}
            savedLocations={savedLocations}
            savedPhones={savedPhones}
            onSelectLocation={handleManualLocation}
            onUseSavedLocation={handleUseSavedLocation}
            saveLocationPreference={saveLocationPreference}
            onToggleSaveLocationPreference={setSaveLocationPreference}
            onUpdateLocation={handleUpdateLocation}
            loading={paymentLoading}
            exchangeRate={dailyRate}
            onSavePhone={handleSaveProfilePhone}
         />
         <LocationModal
            open={locationModal.active}
            onClose={() => {
               setLocationModal({ active: false, location: null })
               setPendingOrderSubmission(false)
            }}
            onSave={saveLocationHandler}
            initialLocation={locationModal.location}
            requireDetails={true}
         />

         <WelcomeModal
            active={welcomeModalOpen}
            onClose={handleCloseWelcome}
            userName={(user as any)?.name?.split(" ")[0]}
         />

         <TicketDetailModal
            ticket={openTicket}
            onClose={() => setOpenTicket(null)}
            onCancel={(id) => onCancelTicket(id as number)}
            onChat={openChat}
            formatPrice={formatPrice}
            exchangeRate={dailyRate}
         />

         {firstCouponModalShow.coupon && (
            <FirstCouponModal
               active={firstCouponModalShow.active}
               onClose={handleCloseFirstCoupon}
               coupon={firstCouponModalShow.coupon}
            />
         )}

         <RedeemModal redeemModal={redeemModal} setRedeemModal={setRedeemModal} />
         <GiftModal
            modal={giftModal}
            email={giftEmail}
            status={giftStatus}
            loading={giftLoading}
            giftingCouponId={giftingCouponId}
            onClose={closeGiftModal}
            onSend={handleGiftSubmit}
            onEmailChange={setGiftEmail}
            isSuccess={giftSuccess}
         />
         <GiftReceivedModal
            active={giftReceivedModal.active}
            gift={giftReceivedModal.activity}
            onClose={closeGiftReceivedModal}
         />
         <LevelBenefitsModal
            active={showBenefits}
            onClose={() => setShowBenefits(false)}
            levelLadder={levelLadder}
            currentLevelId={levelState.currentLevel?.id}
         />

         {/* Header Minimalista (Consolidado) */}
         <header className="fixed left-0 right-0 top-0 z-50 w-full max-w-[100vw] overflow-x-hidden px-4 py-3 bg-[#FFFBEA]/90 backdrop-blur-md border-b border-[#FFFBEA]/20 shadow-sm shadow-[#6A3A30]/5 transition-all duration-300">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
               {/* Left: Menu & User */}
               <div className="flex items-center gap-4">
                  <button
                     onClick={() => setIsMenuOpen(true)}
                     className="p-2 -ml-2 rounded-full hover:bg-[#6A3A30]/5 text-[#6A3A30] transition-colors"
                  >
                     <Menu size={24} />
                  </button>
                  <div className="flex items-center gap-3" onClick={() => setCurrentView("profile")}>
                     <div className="w-8 h-8 rounded-full bg-[#1A864D]/10 text-[#1A864D] flex items-center justify-center font-black text-xs border border-[#1A864D]/20 cursor-pointer hover:scale-105 transition-transform">
                        {((user as any)?.name?.[0] || "C").toUpperCase()}
                     </div>
                     <div className="flex flex-col cursor-pointer">
                        <p className="text-[10px] font-bold text-[#6A3A30]/60 uppercase tracking-widest leading-none mb-0.5">Hola,</p>
                        <p className="font-bold text-[#6A3A30] text-sm max-w-[140px] truncate capitalize leading-none">
                           {(user as any)?.name?.split(" ")[0]?.toLowerCase() || "Cliente"}
                        </p>
                     </div>
                  </div>
               </div>

               {/* Right: Points & Logout */}
               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#6A3A30] text-[#FFFBEA] px-3 py-1.5 rounded-full shadow-lg shadow-[#6A3A30]/20 ring-2 ring-[#FFFBEA]">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#1A864D] animate-pulse" />
                     <span className="text-sm font-bold tabular-nums">{currentState.totalPoints}</span>
                     <span className="text-[10px] font-bold text-[#FFFBEA]/70 uppercase">Pts</span>
                  </div>
                  <button
                     onClick={props.onLogout}
                     className="h-9 w-9 rounded-full bg-[#6A3A30]/5 text-[#6A3A30]/60 hover:bg-[#6A3A30] hover:text-[#FFFBEA] flex items-center justify-center transition-colors"
                     title="Cerrar sesión"
                  >
                     <LogOut size={18} strokeWidth={2} />
                  </button>
               </div>
            </div>
         </header>

         {/* Side Menu Drawer */}
         <div className={`fixed inset-0 z-50 transition-all duration-300 ${isMenuOpen ? "visible" : "invisible"}`}>
            {/* Overlay */}
            <div
               className={`absolute inset-0 bg-[#6A3A30]/40 backdrop-blur-sm transition-opacity duration-300 ${isMenuOpen ? "opacity-100" : "opacity-0"
                  }`}
               onClick={() => setIsMenuOpen(false)}
            />

            {/* Drawer Content */}
            <div
               className={`absolute top-0 left-0 bottom-0 w-3/4 max-w-sm bg-[#FFFBEA] shadow-2xl transition-transform duration-300 ease-out ${isMenuOpen ? "translate-x-0" : "-translate-x-full"
                  }`}
            >
               <div className="p-6 flex flex-col h-full">
                  <div className="flex items-center justify-between mb-8">
                     <h2 className="text-xl font-black text-[#6A3A30]">Menú</h2>
                     <button
                        onClick={() => setIsMenuOpen(false)}
                        className="p-2 rounded-full hover:bg-[#6A3A30]/5 text-[#6A3A30]/60"
                     >
                        <X size={20} />
                     </button>
                  </div>

                  <nav className="space-y-2 flex-1">
                     <button
                        onClick={() => {
                           setCurrentView("home")
                           setIsMenuOpen(false)
                        }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-bold ${currentView === "home" ? "bg-[#6A3A30] text-[#FFFBEA]" : "text-[#6A3A30]/70 hover:bg-[#6A3A30]/5"
                           }`}
                     >
                        <Home size={20} />
                        Inicio
                     </button>
                     <button
                        onClick={() => {
                           setCurrentView("profile")
                           setIsMenuOpen(false)
                        }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-bold ${currentView === "profile" ? "bg-[#6A3A30] text-[#FFFBEA]" : "text-[#6A3A30]/70 hover:bg-[#6A3A30]/5"
                           }`}
                     >
                        <User size={20} />
                        Perfil
                     </button>
                     <button
                        onClick={() => {
                           setCurrentView("games")
                           setIsMenuOpen(false)
                        }}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-colors font-bold ${currentView === "games" ? "bg-[#6A3A30] text-[#FFFBEA]" : "text-[#6A3A30]/70 hover:bg-[#6A3A30]/5"
                           }`}
                     >
                        <Gamepad2 size={20} />
                        Juegos
                     </button>
                  </nav>

                  <div className="border-t border-[#6A3A30]/10 pt-6">
                     <p className="text-xs text-[#6A3A30]/40 font-medium text-center">
                        Brownies Loyalty v1.0
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* Contenido Principal */}
         <main className="relative z-10 mx-auto box-border w-full min-w-0 max-w-6xl overflow-x-hidden px-4 pt-24 sm:px-6 space-y-10">

            {/* Contenido Principal */}
            {currentView === "home" && (
               <>
                  <section className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
                     <DigitalCard
                        user={user}
                        punchSlots={punchSlots}
                        punchesFilled={punchesFilled}
                        nextReward={nextReward}
                        currentState={currentState}
                        levelState={levelState}
                        showRewardAnimation={showRewardAnimation}
                        punchPopVersion={punchPopVersion}
                     />
                  </section>

                  <TicketStatusSection
                     tickets={ticketBuckets}
                     formatPrice={formatPrice}
                     exchangeRate={dailyRate}
                     loading={ticketsInitialLoading}
                     loadError={ticketsLoadError}
                     onCancel={(id) => onCancelTicket(id as number)}
                     onView={setOpenTicket}
                  />

                  {/* Notificación de Pendientes */}
                  {showPendingNotice && pendingPurchases.length > 0 && (
                     <div className="animate-in slide-in-from-top-4 fade-in duration-500">
                        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden">
                           <div className="flex-1 space-y-1 relative z-10">
                              <div className="inline-flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
                                 <AlertCircle size={14} className="fill-amber-100" />
                                 Acción requerida
                              </div>
                              <p className="text-sm font-bold text-slate-900">
                                 {pendingPurchases.length} compras pendientes de escaneo
                              </p>
                              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-lg">
                                 Escanea el código QR de los productos para confirmar tus puntos.
                              </p>
                           </div>

                           <div className="flex items-center gap-2 self-end sm:self-center relative z-10">
                              <button
                                 onClick={() => setClaimScanner((prev) => ({ ...prev, active: true }))}
                                 className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-lg shadow-slate-900/10 transition-all"
                              >
                                 Escanear
                              </button>
                              <button
                                 onClick={onDismissPendingNotice}
                                 className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
                              >
                                 <X size={18} />
                              </button>
                           </div>
                        </div>
                     </div>
                  )}

                  {/* Layout Grid Dashboard */}
                  <div className="grid w-full min-w-0 gap-8 lg:grid-cols-12 lg:gap-10 items-start">

                     {/* Columna Izquierda: Billetera y Historial */}
                     <div className="min-w-0 space-y-12 lg:col-span-7">
                        <WalletSection
                           coupons={coupons}
                           formatCouponSubtitle={formatCouponSubtitle}
                           getCouponStatusLabel={getCouponStatusLabel}
                           openRedeemModal={openRedeemModal}
                           onUseCoupon={handleUseCoupon}
                           onGiftClick={(coupon) => {
                              setGiftModal({ active: true, coupon })
                              setGiftEmail("")
                              setGiftStatus("")
                              setGiftLoading(false)
                           }}
                           giftingCouponId={giftingCouponId}
                        />

                        <div className="hidden lg:block">
                           <HistorySection
                              activityItems={activityItems}
                              lastSeen={historyLastSeen}
                              onViewTicket={setOpenTicket}
                              onLoadMore={onLoadMoreTickets}
                              hasMore={ticketsHasMore}
                              loadingMore={ticketsLoadingMore}
                           />
                        </div>
                     </div>

                     {/* Columna Derecha: Roadmap y Nivel (Rediseñado) */}
                     <div className="min-w-0 space-y-8 lg:col-span-5">
                        <div className="min-w-0 space-y-8 lg:sticky lg:top-24">
                           {/* Nueva Tarjeta de Nivel */}
                           <LevelSection levelState={levelState} onViewBenefits={() => setShowBenefits(true)} />
                           <RoadmapSection ladder={ladder} currentState={currentState} />

                           <div className="lg:hidden">
                              <HistorySection
                                 activityItems={activityItems}
                                 lastSeen={historyLastSeen}
                                 onViewTicket={setOpenTicket}
                                 onLoadMore={onLoadMoreTickets}
                                 hasMore={ticketsHasMore}
                                 loadingMore={ticketsLoadingMore}
                              />
                           </div>
                        </div>
                     </div>
                  </div>
               </>
            )}

            {currentView === "profile" && (
               <ProfileView
                  user={user}
                  phone={profilePhone}
                  cedula={profileCedula}
                  name={profileName}
                  onSavePhone={handleSaveProfilePhone}
                  onSaveCedula={handleSaveProfileCedula}
                  onSaveName={handleSaveProfileName}
                  savedLocations={savedLocations}
                  onDeleteLocation={handleDeleteLocation}
                  onSetDefaultLocation={handleSetDefaultLocation}
                  onAddLocation={() => setLocationModal({ active: true, location: null })}
               />
            )}
            {currentView === "games" && <GamesView />}

         </main>

         {/* FAB - Botones Flotantes (Solo en Home) */}
         {currentView === "home" && !claimScanner.active && !orderView && (
            <div className="fixed bottom-6 inset-x-4 z-40 mx-auto max-w-xs px-1">
               <div className="flex min-w-0 items-center justify-center gap-3">
                  {false && <button
                     onClick={() => setClaimScanner((prev) => ({ ...prev, active: true, last: "" }))}
                     className="group relative flex items-center justify-center gap-3 bg-white text-slate-900 pl-6 pr-8 py-4 rounded-full shadow-[0_20px_30px_-12px_rgba(15,23,42,0.25)] hover:shadow-[0_25px_40px_-12px_rgba(15,23,42,0.35)] transition-all duration-300 hover:scale-105 active:scale-95 border border-slate-200"
                  >
                     <ScanLine size={22} className="text-slate-800" />
                     <div className="relative text-left">
                        <p className="text-sm font-bold leading-none mb-0.5">Escanear</p>
                     </div>
                  </button>}
                  <button
                     onClick={startOrderFlow}
                     className="group relative flex w-full max-w-[260px] items-center justify-center gap-3 rounded-full border-4 border-[#afc8bf] bg-[#6A3A30] py-4 pl-6 pr-7 text-[#FFFBEA] shadow-[0_20px_40px_-10px_rgba(106,58,48,0.4)] transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_25px_50px_-12px_rgba(106,58,48,0.55)] active:scale-[0.98]"
                  >
                     <ShoppingBag size={22} className="text-[#FFFBEA]" />
                     <div className="relative text-left">
                        <p className="text-sm font-bold leading-none mb-0.5">Hacer pedido</p>
                     </div>
                     {cartTotals.items > 0 && (
                        <span className="absolute -top-2 right-1 bg-rose-500 text-white text-[10px] font-black rounded-full px-2 py-0.5 shadow-lg animate-bounce">
                           {cartTotals.items}
                        </span>
                     )}
                  </button>
               </div>
            </div>
         )}
      </div>
   )
}






