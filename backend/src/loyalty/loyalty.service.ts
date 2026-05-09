import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
  ForbiddenException,
  Inject,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, In, EntityManager, MoreThanOrEqual, Between, IsNull, LessThan } from 'typeorm'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { isUUID } from 'class-validator'
import {
  loyaltyRules,
  rewardLadder,
  getNextThreshold,
  levelLadder,
  levelWindowDays,
  type LevelDefinition,
  type LoyaltyRulesResponse,
  type RewardDefinition,
} from './loyalty.rules'
import * as webpush from 'web-push'
import { PushSubscription } from './entities/push-subscription.entity'
import { Redis } from 'ioredis'
import { ProductClaim, type ProductClaimStatus } from './entities/product-claim.entity'
import { Coupon, type CouponStatus } from './entities/coupon.entity'
import { User } from './entities/user.entity'
import { UserLevel } from './entities/user-level.entity'
import { UserActivity, type ActivityType } from './entities/user-activity.entity'
import { randomUUID } from 'crypto'
import { RegisterSaleDto } from './dto/register-sale.dto'
import { LookupUserDto } from './dto/lookup-user.dto'
import { Ticket } from './entities/ticket.entity'
import { Location } from './entities/location.entity'
import { SaleEvent } from './entities/sale-event.entity'
import { BusinessStatus } from './entities/business-status.entity'
import { Expense } from './entities/expense.entity'
import { RegisterExpenseDto } from './dto/register-expense.dto'
import { ResetDataDto } from './dto/reset-data.dto'
import { LoyaltyRulesConfig } from './entities/loyalty-rules.entity'
import { Product } from './entities/product.entity'
import { PickupLocation } from './entities/pickup-location.entity'
import { ExchangeRate } from './entities/exchange-rate.entity'
import { CashClosure } from './entities/cash-closure.entity'

type PaymentDetailInput = {
  method?: string | null
  amount?: number | string | null
  currency?: string | null
  amountNative?: number | string | null
  currencyNative?: string | null
  amountUsd?: number | string | null
  exchangeRate?: number | string | null
}

type PersistedPaymentDetail = {
  method: string
  amount: number
  currency: 'USD' | 'VES'
  amountNative: number
  currencyNative: 'USD' | 'VES'
  amountUsd: number
  exchangeRate: number | null
}

type NormalizedPaymentDetail = {
  method: string
  amountNativeCents: number
  currencyNative: 'USD' | 'VES'
  amountUsdCents: number
  exchangeRate: number | null
}

type SaleItemWithPayment = RegisterSaleDto['items'][number] & {
  paymentMethod?: string | null
  paymentDetails?: PaymentDetailInput[] | null
}

type HistoricalExchangeRateEntry = {
  fuente?: string
  compra?: number
  venta?: number
  promedio?: number
  fecha?: string
}

type ResolvedExchangeRate = {
  rate: number | null
  date: string | null
  source: string
  lastUpdated: string
  status: 'online' | 'offline'
}

type CashClosureLineInput = {
  method?: unknown
  expectedUsd?: unknown
  expectedVes?: unknown
  countedUsd?: unknown
  countedVes?: unknown
  diffUsd?: unknown
  diffVes?: unknown
  nativeCurrency?: unknown
  hasActivity?: unknown
  hasDifference?: unknown
}

type CashClosureLine = {
  method: string
  expectedUsd: number
  expectedVes: number
  countedUsd: number
  countedVes: number
  diffUsd: number
  diffVes: number
  nativeCurrency: 'USD' | 'VES'
  hasActivity: boolean
  hasDifference: boolean
}

type CreateCashClosurePayload = {
  businessDate?: unknown
  exchangeRate?: unknown
  expectedUsd?: unknown
  expectedVes?: unknown
  countedUsd?: unknown
  countedVes?: unknown
  diffUsd?: unknown
  diffVes?: unknown
  differenceCount?: unknown
  lines?: CashClosureLineInput[]
  note?: unknown
}

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(ProductClaim) private readonly claimRepo: Repository<ProductClaim>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserLevel) private readonly userLevelRepo: Repository<UserLevel>,
    @InjectRepository(UserActivity) private readonly activityRepo: Repository<UserActivity>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    @InjectRepository(PickupLocation) private readonly pickupLocationRepo: Repository<PickupLocation>,
    @InjectRepository(SaleEvent) private readonly saleRepo: Repository<SaleEvent>,
    @InjectRepository(BusinessStatus) private readonly businessStatusRepo: Repository<BusinessStatus>,
    @InjectRepository(Expense) private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(LoyaltyRulesConfig) private readonly rulesRepo: Repository<LoyaltyRulesConfig>,
    @InjectRepository(PushSubscription) private readonly pushRepo: Repository<PushSubscription>,
    @InjectRepository(ExchangeRate) private readonly exchangeRateRepo: Repository<ExchangeRate>,
    @InjectRepository(CashClosure) private readonly cashClosureRepo: Repository<CashClosure>,
    private readonly dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // Run cleanup every hour
    setInterval(() => {
      this.deleteOldPendingTickets().catch(err => console.error('Error cleaning old tickets', err))
    }, 60 * 60 * 1000)
    // Run once on startup
    setTimeout(() => {
      this.deleteOldPendingTickets().catch(err => console.error('Error cleaning old tickets', err))
    }, 5000)

    // Provisional customers keep points for 7 days, then are removed to avoid stale user rows.
    setInterval(() => {
      this.cleanupExpiredProvisionalUsers().catch(err => console.error('Error cleaning provisional users', err))
    }, 24 * 60 * 60 * 1000)
    setTimeout(() => {
      this.cleanupExpiredProvisionalUsers().catch(err => console.error('Error cleaning provisional users', err))
    }, 10000)

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      )
    } else {
      console.warn('[LoyaltyService] Push notifications disabled: missing VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT')
    }
  }

  private async invalidateUserState(userId?: string | null) {
    if (!userId) return
    await this.cacheManager.del(`user_state_${userId}`)
  }

  private async clearDashboardStats() {
    await this.cacheManager.del('admin_dashboard_stats')
  }

  private sanitizeUser(user?: User | null) {
    if (!user) return user ?? null
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      cedula: user.cedula ?? null,
      phoneNumber: user.phoneNumber ?? null,
      role: user.role,
      isProvisional: user.isProvisional,
      provisionalExpiresAt: user.provisionalExpiresAt ?? null,
      createdAt: user.createdAt,
      hasSeenWelcome: user.hasSeenWelcome,
      hasSeenFirstCoupon: user.hasSeenFirstCoupon,
      lastGiftSeenAt: user.lastGiftSeenAt ?? null,
    }
  }

  private serializeTicket(ticket: Ticket) {
    return {
      ...ticket,
      user: this.sanitizeUser(ticket.user),
    }
  }

  async deleteOldPendingTickets() {
    // Expiration time: 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await this.ticketRepo
      .createQueryBuilder('ticket')
      .delete()
      .where('status = :status', { status: 'pending' })
      .andWhere('createdAt < :date', { date: twentyFourHoursAgo })
      .execute()
  }

  private buildProvisionalExpiresAt(base = new Date()) {
    return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000)
  }

  private isExpiredProvisionalUser(user?: User | null) {
    if (!user?.isProvisional || !user.provisionalExpiresAt) return false
    return user.provisionalExpiresAt.getTime() <= Date.now()
  }

  private buildProvisionalEmail(cedula?: string | null, email?: string | null) {
    const normalizedEmail = email?.trim().toLowerCase()
    if (normalizedEmail) return normalizedEmail
    const stablePiece = cedula?.replace(/\D/g, '') || randomUUID()
    return `guest-${stablePiece}-${Date.now()}@temp.local`
  }

  private async getOrCreateProvisionalUser(
    input: { cedula?: string | null; email?: string | null; name?: string | null; phone?: string | null },
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(User) : this.userRepo
    const normalizedCedula = input.cedula?.replace(/\D/g, '') || null
    const normalizedEmail = input.email?.trim().toLowerCase() || null

    if (!normalizedCedula && !normalizedEmail) {
      throw new BadRequestException('La cedula o el correo son requeridos para crear un cliente provisional')
    }

    let user =
      (normalizedCedula && await repo.findOne({ where: { cedula: normalizedCedula } })) ||
      (normalizedEmail && await repo.findOne({ where: { email: normalizedEmail } })) ||
      null

    if (this.isExpiredProvisionalUser(user)) {
      await this.cleanupExpiredProvisionalUsers()
      user = null
    }

    if (user) return user

    const provisional = repo.create({
      email: this.buildProvisionalEmail(normalizedCedula, normalizedEmail),
      cedula: normalizedCedula,
      name: this.trimToLength(input.name ?? null, 100) ?? (normalizedCedula ? `Cliente ${normalizedCedula}` : 'Cliente provisional'),
      phoneNumber: this.trimToLength(input.phone ?? null, 20),
      role: 'client',
      isProvisional: true,
      provisionalExpiresAt: this.buildProvisionalExpiresAt(),
    })

    try {
      return await repo.save(provisional)
    } catch (err) {
      console.error('Error saving provisional user:', err)
      throw new BadRequestException('No se pudo crear el cliente provisional. Verifique que la cedula o correo sean unicos.')
    }
  }

  async cleanupExpiredProvisionalUsers(now = new Date()) {
    return this.dataSource.transaction(async (manager) => {
      const repoUser = manager.getRepository(User)
      const repoSale = manager.getRepository(SaleEvent)
      const expired = await repoUser.find({
        where: { isProvisional: true, provisionalExpiresAt: LessThan(now) },
        select: ['id'],
      })

      const ids = expired.map((user) => user.id)
      if (!ids.length) return { deleted: 0 }

      await repoSale.update({ customerId: In(ids) }, { customerId: null, customerEmail: null })
      const result = await repoUser.delete({ id: In(ids) })
      await this.clearDashboardStats()
      await Promise.all(ids.map((id) => this.invalidateUserState(id)))
      return { deleted: result.affected ?? 0 }
    })
  }

  private async sumClaimedPoints(userId: string, repo?: Repository<ProductClaim>) {
    const source = repo ?? this.claimRepo
    const result = await source
      .createQueryBuilder('claim')
      .select('COALESCE(SUM(claim.points), 0)', 'total')
      .where('claim.claimed_by = :userId', { userId })
      .andWhere('claim.status = :status', { status: 'claimed' })
      .getRawOne<{ total: string | number }>()

    const raw = result?.total
    const total = typeof raw === 'string' ? Number(raw) : Number(raw ?? 0)
    return Number.isFinite(total) ? total : 0
  }

  private normalizeSaleCode(value?: string | null) {
    const raw = value?.trim()
    if (!raw) return null
    return raw.toLowerCase().startsWith('claim:') ? raw.slice(6) : raw
  }

  private trimToLength(value: string | null | undefined, limit: number) {
    if (!value) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.length > limit ? trimmed.slice(0, limit) : trimmed
  }

  private buildDefaultRules(): LoyaltyRulesResponse {
    return {
      ...loyaltyRules,
      rewardLadder,
      levelWindowDays,
      levelLadder,
    }
  }

  private readRuleNumber(value: any, fallback: number) {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  private normalizeRules(payload?: Partial<LoyaltyRulesResponse> | null): LoyaltyRulesResponse {
    const defaults = this.buildDefaultRules()
    const incoming = payload ?? {}

    const pointsPerProduct = this.readRuleNumber(incoming.pointsPerProduct, defaults.pointsPerProduct)
    const firstThreshold = this.readRuleNumber(incoming.firstThreshold, defaults.firstThreshold)
    const thresholdStep = this.readRuleNumber(incoming.thresholdStep, defaults.thresholdStep)
    const couponExpiryDays = this.readRuleNumber(incoming.couponExpiryDays, defaults.couponExpiryDays)
    const levelMonthlyCouponExpiryDays = this.readRuleNumber(
      incoming.levelMonthlyCouponExpiryDays,
      defaults.levelMonthlyCouponExpiryDays ?? 0,
    )
    const levelMonthlyCouponRenewDay = this.readRuleNumber(
      incoming.levelMonthlyCouponRenewDay,
      defaults.levelMonthlyCouponRenewDay ?? 1,
    )
    const levelWindowDaysValue = this.readRuleNumber(
      incoming.levelWindowDays,
      defaults.levelWindowDays ?? 0,
    )

    const rewardLadder = Array.isArray(incoming.rewardLadder)
      ? incoming.rewardLadder.map((reward: RewardDefinition) => ({
        ...reward,
        threshold: this.readRuleNumber(reward.threshold, 0),
        expiresInDays: this.readRuleNumber(reward.expiresInDays, couponExpiryDays),
        value: reward.value === undefined || reward.value === null
          ? reward.value
          : this.readRuleNumber(reward.value, reward.value ?? 0),
        capUsd: reward.capUsd === undefined || reward.capUsd === null
          ? reward.capUsd
          : this.readRuleNumber(reward.capUsd, reward.capUsd ?? 0),
      }))
      : defaults.rewardLadder

    const levelLadder = Array.isArray(incoming.levelLadder)
      ? incoming.levelLadder.map((level) => {
        const perks = level.perks ?? {}
        const monthlyCoupons = Array.isArray(perks.monthlyCoupons)
          ? perks.monthlyCoupons.map((pack) => ({
            ...pack,
            percent: this.readRuleNumber(pack.percent, 0),
            quantity: this.readRuleNumber(pack.quantity, 0),
          }))
          : []

        return {
          ...level,
          minPoints: this.readRuleNumber(level.minPoints, 0),
          windowDays: this.readRuleNumber(level.windowDays, levelWindowDaysValue),
          perks: {
            ...perks,
            monthlyCoupons,
            monthlyCouponExpiryDays: this.readRuleNumber(
              perks.monthlyCouponExpiryDays,
              levelMonthlyCouponExpiryDays,
            ),
            monthlyCouponRenewDay: this.readRuleNumber(
              perks.monthlyCouponRenewDay,
              levelMonthlyCouponRenewDay,
            ),
          },
        }
      })
      : defaults.levelLadder

    return {
      ...defaults,
      ...incoming,
      pointsPerProduct,
      firstThreshold,
      thresholdStep,
      couponExpiryDays,
      levelMonthlyCouponExpiryDays,
      levelMonthlyCouponRenewDay,
      levelWindowDays: levelWindowDaysValue,
      rewardLadder,
      levelLadder,
    }
  }

  private async getActiveRules(manager?: EntityManager): Promise<LoyaltyRulesResponse> {
    const repo = manager ? manager.getRepository(LoyaltyRulesConfig) : this.rulesRepo
    const [record] = await repo.find({ order: { updatedAt: 'DESC' }, take: 1 })
    if (record?.rules) return this.normalizeRules(record.rules)

    const defaults = this.buildDefaultRules()
    const created = repo.create({ rules: defaults })
    await repo.save(created)
    return defaults
  }

  async updateRules(payload: Partial<LoyaltyRulesResponse>) {
    const normalized = this.normalizeRules(payload)
    const [existing] = await this.rulesRepo.find({ order: { updatedAt: 'DESC' }, take: 1 })
    if (existing) {
      existing.rules = normalized
      const saved = await this.rulesRepo.save(existing)
      return this.normalizeRules(saved.rules)
    }

    const created = this.rulesRepo.create({ rules: normalized })
    const saved = await this.rulesRepo.save(created)
    return this.normalizeRules(saved.rules)
  }

  private adjustSaleItemsForTotal(
    items: SaleItemWithPayment[],
    total?: number | null,
    discount?: number | null,
  ) {
    if (!items.length) return items

    const baseTotal = items.reduce((sum, item) => {
      const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
      return sum + (Number(item.price ?? 0) * qty)
    }, 0)

    const totalValue = typeof total === 'number' && Number.isFinite(total) ? total : null
    const discountValue = typeof discount === 'number' && Number.isFinite(discount) ? discount : null
    const targetTotal = totalValue ?? (discountValue !== null ? baseTotal - discountValue : null)

    if (targetTotal === null || !Number.isFinite(targetTotal)) return items
    if (baseTotal <= 0 || targetTotal < 0) return items
    if (Math.abs(targetTotal - baseTotal) < 0.01) return items

    const roundMoney = (value: number) => Math.round(value * 100) / 100
    let remaining = roundMoney(targetTotal)

    return items.map((item, idx) => {
      const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
      const lineBase = Number(item.price ?? 0) * qty
      const share = baseTotal > 0 ? (targetTotal * lineBase) / baseTotal : 0
      const lineTotal = idx === items.length - 1 ? remaining : roundMoney(share)
      remaining = roundMoney(remaining - lineTotal)
      const adjustedPrice = qty ? lineTotal / qty : 0
      return { ...item, price: adjustedPrice }
    })
  }

  private roundMoney(value: number) {
    return Math.round((Number(value) || 0) * 100) / 100
  }

  private normalizeItemQuantity(value: unknown) {
    const parsed = Number(value ?? 1)
    return Math.max(1, Math.round(Number.isFinite(parsed) ? parsed : 1))
  }

  private async clearProductsCache() {
    await Promise.all([
      this.cacheManager.del('products:backoffice'),
      this.cacheManager.del('products:public'),
      this.cacheManager.del('products_all'),
    ])
  }

  private async hydrateSaleItemsWithCatalog(
    items: SaleItemWithPayment[],
    manager?: EntityManager,
    options: { requireActive?: boolean; checkStock?: boolean } = {},
  ): Promise<SaleItemWithPayment[]> {
    const normalizedItems = Array.isArray(items) ? items : []
    const productIds = Array.from(new Set(
      normalizedItems
        .map((item) => (typeof item?.productId === 'string' ? item.productId.trim() : ''))
        .filter((value) => value && isUUID(value)),
    ))

    const productsById = new Map<string, Product>()
    if (productIds.length) {
      const repoProduct = manager?.getRepository(Product) ?? this.productRepo
      const products = await repoProduct.find({ where: { id: In(productIds) } })
      products.forEach((product) => productsById.set(product.id, product))
    }

    return normalizedItems.map((item) => {
      const productId = typeof item?.productId === 'string' ? item.productId.trim() : ''
      const product = productId ? productsById.get(productId) : undefined
      const quantity = this.normalizeItemQuantity(item?.quantity)

      if (productId && !product) {
        throw new BadRequestException('Producto no encontrado en el catalogo')
      }
      if (product && options.requireActive && !product.active) {
        throw new BadRequestException(`El producto "${product.name}" no esta disponible`)
      }
      if (product && options.checkStock && product.stock < quantity) {
        throw new BadRequestException(`No hay stock suficiente para "${product.name}"`)
      }

      const rawPrice = Number(item?.price ?? 0)
      const rawPoints = Number(item?.points ?? 0)

      return {
        ...(item ?? {}),
        productId: product?.id ?? item?.productId,
        name: product?.name ?? item?.name ?? 'Venta',
        price: product ? this.roundMoney(product.price) : this.roundMoney(rawPrice),
        points: product ? Number(product.points ?? 0) : (Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0),
        quantity,
      }
    })
  }

  private async decrementProductStock(items: SaleItemWithPayment[], manager: EntityManager) {
    const quantities = new Map<string, number>()
    ;(Array.isArray(items) ? items : []).forEach((item) => {
      const productId = typeof item?.productId === 'string' ? item.productId.trim() : ''
      if (!productId || !isUUID(productId)) return
      const quantity = this.normalizeItemQuantity(item?.quantity)
      quantities.set(productId, (quantities.get(productId) ?? 0) + quantity)
    })

    const productIds = Array.from(quantities.keys())
    if (!productIds.length) return

    const repoProduct = manager.getRepository(Product)
    const products = await repoProduct
      .createQueryBuilder('product')
      .setLock('pessimistic_write')
      .where('product.id IN (:...productIds)', { productIds })
      .getMany()
    const productsById = new Map(products.map((product) => [product.id, product]))

    for (const [productId, quantity] of quantities) {
      const product = productsById.get(productId)
      if (!product) throw new BadRequestException('Producto no encontrado en el catalogo')
      if (!product.active) throw new BadRequestException(`El producto "${product.name}" no esta disponible`)
      if (product.stock < quantity) throw new BadRequestException(`No hay stock suficiente para "${product.name}"`)
      product.stock -= quantity
    }

    await repoProduct.save(products)
    await this.clearProductsCache()
  }

  private toMoneyCents(value: unknown) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return 0
    return Math.round(parsed * 100)
  }

  private fromMoneyCents(cents: number) {
    return this.roundMoney(cents / 100)
  }

  private normalizePaymentMethod(value?: string | null) {
    const trimmed = value?.trim().toLowerCase()
    if (!trimmed) return null
    return this.trimToLength(trimmed.replace(/\s+/g, '_'), 80)
  }

  private inferPaymentCurrency(method?: string | null, currency?: string | null) {
    const normalizedCurrency = typeof currency === 'string' ? currency.trim().toUpperCase() : ''
    if (normalizedCurrency === 'VES' || normalizedCurrency === 'USD') return normalizedCurrency
    const normalizedMethod = typeof method === 'string' ? method.trim().toLowerCase() : ''
    const settlementMethod = normalizedMethod.replace(/^vuelto_/, '').replace(/^change_/, '')
    if (['efectivo_bs', 'pago_movil', 'punto', 'transferencia', 'otro', 'sin_metodo_bs'].includes(settlementMethod)) return 'VES'
    return 'USD'
  }

  private normalizePaymentDetails(details?: PaymentDetailInput[] | null, exchangeRate?: number | null) {
    if (!Array.isArray(details)) return []
    const rate = this.parseExchangeRate(exchangeRate)
    return details
      .map((detail) => {
        const method = this.normalizePaymentMethod(detail?.method ?? null)
        const amountSource = detail?.amountNative ?? detail?.amount
        const amountNativeCents = this.toMoneyCents(amountSource)
        if (!method || amountNativeCents <= 0) return null
        const currencyNative = this.inferPaymentCurrency(method, detail?.currencyNative ?? detail?.currency) as 'USD' | 'VES'
        const explicitAmountUsdCents = this.toMoneyCents(detail?.amountUsd)
        const amountUsdCents = explicitAmountUsdCents > 0
          ? explicitAmountUsdCents
          : currencyNative === 'VES' && rate
            ? Math.round((amountNativeCents * 100) / Math.round(rate * 100))
            : amountNativeCents
        const detailRate = this.parseExchangeRate(detail?.exchangeRate) ?? rate ?? null
        return {
          method,
          amountNativeCents,
          currencyNative,
          amountUsdCents,
          exchangeRate: detailRate,
        }
      })
      .filter((detail): detail is NormalizedPaymentDetail => Boolean(detail))
  }

  private serializePaymentDetail(detail: NormalizedPaymentDetail): PersistedPaymentDetail {
    const amountNative = this.fromMoneyCents(detail.amountNativeCents)
    return {
      method: detail.method,
      amount: amountNative,
      currency: detail.currencyNative,
      amountNative,
      currencyNative: detail.currencyNative,
      amountUsd: this.fromMoneyCents(detail.amountUsdCents),
      exchangeRate: detail.exchangeRate,
    }
  }

  private allocatePaymentDetailsByItem(
    items: SaleItemWithPayment[],
    details?: PaymentDetailInput[] | null,
    exchangeRate?: number | null,
  ) {
    const normalizedDetails = this.normalizePaymentDetails(details, exchangeRate)
    if (!items.length || !normalizedDetails.length) return []

    const lineCents = items.map((item) => {
      const qty = Math.max(1, Number(item.quantity ?? 1) || 1)
      return this.toMoneyCents(Number(item.price ?? 0) * qty)
    })
    const totalCents = lineCents.reduce((sum, value) => sum + value, 0)
    if (totalCents <= 0) return []

    const allocated: Array<{ method: string; amount: number; currency?: string }[]> = items.map(() => [])
    normalizedDetails.forEach((detail) => {
      let remainingNative = detail.amountNativeCents
      let remainingUsd = detail.amountUsdCents
      lineCents.forEach((line, idx) => {
        const isLast = idx === lineCents.length - 1
        const nativeShare = isLast ? remainingNative : Math.round((detail.amountNativeCents * line) / totalCents)
        const usdShare = isLast ? remainingUsd : Math.round((detail.amountUsdCents * line) / totalCents)
        remainingNative -= nativeShare
        remainingUsd -= usdShare
        if (nativeShare <= 0 && usdShare <= 0) return
        allocated[idx].push(this.serializePaymentDetail({
          ...detail,
          amountNativeCents: nativeShare,
          amountUsdCents: usdShare,
        }))
      })
    })

    return allocated
  }

  private isPointsBlockingCoupon(coupon?: Coupon | null) {
    return coupon?.kind === 'free-item' || coupon?.kind === 'combo'
  }

  private computeCouponCoverage(
    items: Array<{ price?: number; quantity?: number }>,
    capUsd: number,
  ) {
    const coverage = Array.from({ length: items.length }, () => 0)
    if (!Number.isFinite(capUsd) || capUsd <= 0) return coverage

    const ordered = items
      .map((item, index) => {
        const price = Number(item?.price ?? 0)
        const quantity = Math.max(1, Number(item?.quantity ?? 1) || 1)
        return {
          index,
          price,
          quantity,
        }
      })
      .filter((entry) => Number.isFinite(entry.price) && entry.price > 0 && entry.quantity > 0)
      .sort((a, b) => a.price - b.price)

    const round = (val: number) => Math.round(val * 100) / 100
    let remaining = round(capUsd)

    for (const entry of ordered) {
      if (remaining <= 0.005) break
      const unitPrice = round(entry.price)

      // Calculate how many we can fully cover with remaining amount
      // We add a tiny epsilon to remaining to avoid 4.999999 / 2.5 flooring to 1 instead of 2
      const maxFullUnits = Math.floor((remaining + 0.001) / unitPrice)

      let coveredUnits = Math.min(entry.quantity, Math.max(0, maxFullUnits))

      // Deduct cost
      remaining = round(remaining - (coveredUnits * unitPrice))

      // If there is still a remainder (partial coverage), cover one more unit if available
      // Check > 0.005 to treat tiny dust as zero
      if (remaining > 0.005 && coveredUnits < entry.quantity) {
        coveredUnits += 1
        remaining = 0
      }
      coverage[entry.index] = coveredUnits
    }

    return coverage
  }

  private applyCouponPointBlocking(items: any[], coupon?: Coupon | null) {
    const normalizedItems = (Array.isArray(items) ? items : []).map((item) => {
      const base = item ?? {}
      const { noPointsByCoupon, coveredUnits, eligibleUnits, pointsAwarded, ...rest } = base
      const quantity = Math.max(1, Number(base.quantity ?? 1) || 1)
      const rawPrice = Number(base.price ?? 0)
      const rawPoints = Number(base.points ?? 0)
      return {
        ...rest,
        quantity,
        price: Number.isFinite(rawPrice) ? rawPrice : 0,
        points: Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0,
      }
    })

    const shouldBlock = this.isPointsBlockingCoupon(coupon)
    const capUsd = Number(coupon?.capUsd ?? 0)
    const coverage = shouldBlock
      ? this.computeCouponCoverage(normalizedItems, capUsd)
      : Array.from({ length: normalizedItems.length }, () => 0)

    const adjustedItems = normalizedItems.map((item, index) => {
      const quantity = Math.max(1, Number(item.quantity ?? 1) || 1)
      const covered = Math.max(0, Math.min(quantity, Number(coverage[index] ?? 0) || 0))
      const eligible = Math.max(0, quantity - covered)
      const rawPoints = Number(item.points ?? 0)
      const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0
      const pointsAwarded = pointsPerUnit * eligible
      const noPoints = covered > 0 && eligible === 0
      return {
        ...item,
        quantity,
        points: pointsPerUnit,
        coveredUnits: covered,
        eligibleUnits: eligible,
        pointsAwarded,
        ...(noPoints ? { noPointsByCoupon: true } : {}),
      }
    })

    const totalPoints = adjustedItems.reduce((sum, item) => {
      const points = Number(item.pointsAwarded ?? 0)
      if (!Number.isFinite(points)) return sum
      return sum + Math.max(0, points)
    }, 0)

    return { items: adjustedItems, points: totalPoints, coverage }
  }

  private async hydrateTicketItemsWithCatalogPoints(
    items: any[],
    manager?: EntityManager,
  ) {
    return this.hydrateSaleItemsWithCatalog(items, manager, {
      requireActive: true,
      checkStock: true,
    })
  }

  private computeTicketPointsFromItems(items?: any[] | null) {
    if (!Array.isArray(items) || !items.length) return 0
    return items.reduce((sum, item) => {
      const awardedRaw = Number(item?.pointsAwarded)
      if (Number.isFinite(awardedRaw)) {
        return sum + Math.max(0, awardedRaw)
      }

      const rawEligible = Number(item?.eligibleUnits)
      const eligibleUnits = Number.isFinite(rawEligible)
        ? Math.max(0, rawEligible)
        : Math.max(1, Number(item?.quantity ?? 1) || 1)

      const rawPoints = Number(item?.points ?? 0)
      const pointsPerUnit = Number.isFinite(rawPoints) ? Math.max(0, rawPoints) : 0

      return sum + (pointsPerUnit * eligibleUnits)
    }, 0)
  }

  private parseExchangeRate(value: unknown) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return Math.round(parsed * 100) / 100
  }

  private getCaracasDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    const get = (type: string) => parts.find((part) => part.type === type)?.value
    const year = get('year')
    const month = get('month')
    const day = get('day')
    return year && month && day ? `${year}-${month}-${day}` : date.toISOString().slice(0, 10)
  }

  private parseDateKey(value: unknown) {
    if (!value) return null
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null
      return this.getCaracasDateKey(value)
    }

    const raw = String(value).trim()
    const directMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (directMatch) return `${directMatch[1]}-${directMatch[2]}-${directMatch[3]}`

    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return null
    return this.getCaracasDateKey(parsed)
  }

  private async fetchOfficialHistoricalRates() {
    const todayKey = this.getCaracasDateKey()
    const cacheKey = `exchange_rate_history_official_${todayKey}`
    const cached = await this.cacheManager.get(cacheKey)
    if (Array.isArray(cached)) return cached as HistoricalExchangeRateEntry[]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/historicos/dolares/oficial', { signal: controller.signal })
      if (!res.ok) {
        console.warn('Historical Exchange API returned:', res.status)
        return []
      }

      const data = await res.json()
      const entries = Array.isArray(data) ? data : []
      await this.cacheManager.set(cacheKey, entries, 6 * 60 * 60 * 1000)
      return entries as HistoricalExchangeRateEntry[]
    } catch (err: any) {
      console.error('Historical Exchange API Error:', err?.message ?? err)
      return []
    } finally {
      clearTimeout(timeout)
    }
  }

  private mapExchangeRateRecord(record: ExchangeRate, status: 'online' | 'offline' = 'online') {
    return {
      rate: this.parseExchangeRate(record.rate) ?? 0,
      date: record.date,
      requestedDate: record.date,
      source: record.source,
      lastUpdated: record.fetchedAt?.toISOString?.() ?? new Date().toISOString(),
      status,
    }
  }

  private async persistExchangeRate(date: string, rate: number, source: string) {
    const parsedRate = this.parseExchangeRate(rate)
    if (!date || !parsedRate) return null

    const record = this.exchangeRateRepo.create({
      date,
      rate: parsedRate,
      source: this.trimToLength(source, 50) ?? 'official',
      fetchedAt: new Date(),
    })
    await this.exchangeRateRepo.save(record)
    return record
  }

  private async fetchCurrentExchangeRateFromProviders() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch('https://api.dolarvzla.com/public/exchange-rate', { signal: controller.signal })
      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        let rate = 0
        let sourceDate = this.getCaracasDateKey()
        if (data?.current?.date) {
          rate = Number(data.current.usd)
          const currentDateKey = String(data.current.date).slice(0, 10)
          sourceDate = currentDateKey
          if (currentDateKey > this.getCaracasDateKey() && data.previous?.usd) {
            rate = Number(data.previous.usd)
            sourceDate = this.parseDateKey(data.previous.date) ?? this.getCaracasDateKey()
          }
        }
        const parsedRate = this.parseExchangeRate(rate)
        if (parsedRate) return { rate: parsedRate, source: 'dolarvzla', sourceDate }
      } else {
        console.warn('Primary Exchange API returned:', res.status, res.statusText)
      }
    } catch (e: any) {
      console.error('Primary Exchange API Error:', e.message)
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: controller.signal })
      clearTimeout(timeout)

      if (res.ok) {
        const data = await res.json()
        const rate = this.parseExchangeRate(data?.promedio)
        const sourceDate = this.parseDateKey(data?.fecha) ?? this.getCaracasDateKey()
        if (rate) return { rate, source: 'dolarapi', sourceDate }
      } else {
        console.warn('Fallback Exchange API returned:', res.status)
      }
    } catch (e: any) {
      console.error('Fallback Exchange API Error:', e.message)
    }

    return null
  }

  async getExchangeRateForDate(value: unknown) {
    const requestedDate = this.parseDateKey(value)
    if (!requestedDate) {
      throw new BadRequestException('Fecha invalida para consultar tasa historica')
    }

    const persisted = await this.exchangeRateRepo.findOne({ where: { date: requestedDate } })
    if (persisted) {
      return this.mapExchangeRateRecord(persisted)
    }

    const todayKey = this.getCaracasDateKey()
    if (requestedDate >= todayKey) {
      const current = await this.getExchangeRate()
      return { ...current, requestedDate, date: requestedDate }
    }

    const cacheKey = `exchange_rate_historical_${requestedDate}`
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) {
      return cached as {
        rate: number
        date: string
        requestedDate: string
        source: string
        lastUpdated: string
        status: 'online' | 'offline'
      }
    }

    const entries = await this.fetchOfficialHistoricalRates()
    const candidates = entries
      .map((entry) => {
        const date = this.parseDateKey(entry.fecha)
        const rate = this.parseExchangeRate(entry.promedio ?? entry.venta ?? entry.compra)
        return date && rate ? { date, rate } : null
      })
      .filter((entry): entry is { date: string; rate: number } => Boolean(entry))
      .filter((entry) => entry.date <= requestedDate)
      .sort((a, b) => b.date.localeCompare(a.date))

    const match = candidates[0]
    if (!match) {
      return {
        rate: 0,
        date: requestedDate,
        requestedDate,
        source: 'historical-unavailable',
        lastUpdated: new Date().toISOString(),
        status: 'offline' as const,
      }
    }

    await this.persistExchangeRate(requestedDate, match.rate, match.date === requestedDate ? 'historical' : `historical:${match.date}`)
    const result = {
      rate: match.rate,
      date: requestedDate,
      requestedDate,
      rateDate: match.date,
      source: match.date === requestedDate ? 'historical' : `historical:${match.date}`,
      lastUpdated: new Date().toISOString(),
      status: 'online' as const,
    }
    await this.cacheManager.set(cacheKey, result, 24 * 60 * 60 * 1000)
    return result
  }

  private async resolveExchangeRateForDate(value: unknown, fallback?: unknown): Promise<ResolvedExchangeRate> {
    const date = this.parseDateKey(value) ?? this.getCaracasDateKey()
    try {
      const resolved = await this.getExchangeRateForDate(date)
      const serverRate = this.parseExchangeRate(resolved?.rate)
      if (serverRate) {
        return {
          rate: serverRate,
          date,
          source: resolved?.source ?? 'official',
          lastUpdated: resolved?.lastUpdated ?? new Date().toISOString(),
          status: 'online',
        }
      }
    } catch (err) {
      console.error('resolveExchangeRateForDate error', err)
    }

    const fallbackRate = this.parseExchangeRate(fallback)
    return {
      rate: fallbackRate,
      date: fallbackRate ? date : null,
      source: fallbackRate ? 'client-fallback' : 'unavailable',
      lastUpdated: new Date().toISOString(),
      status: fallbackRate ? 'online' : 'offline',
    }
  }

  private async resolveCurrentExchangeRate(fallback?: unknown) {
    const today = this.getCaracasDateKey()
    return this.resolveExchangeRateForDate(today, fallback)
  }

  private async enrichTicketsWithHistoricalExchangeRates(tickets: Ticket[]) {
    const missing = tickets.filter((ticket) => !this.parseExchangeRate(ticket.exchangeRate))
    if (!missing.length) return tickets

    const rateByDate = new Map<string, number | null>()
    const dateKeys = Array.from(new Set(missing
      .map((ticket) => this.parseDateKey(ticket.createdAt))
      .filter((dateKey): dateKey is string => Boolean(dateKey))))

    await Promise.all(dateKeys.map(async (dateKey) => {
      try {
        const result = await this.getExchangeRateForDate(dateKey)
        rateByDate.set(dateKey, this.parseExchangeRate(result.rate))
      } catch {
        rateByDate.set(dateKey, null)
      }
    }))

    tickets.forEach((ticket) => {
      if (this.parseExchangeRate(ticket.exchangeRate)) return
      const dateKey = this.parseDateKey(ticket.createdAt)
      const rate = dateKey ? rateByDate.get(dateKey) : null
      if (rate) {
        ticket.exchangeRate = rate
        ticket.exchangeRateDate = dateKey
      }
    })

    return tickets
  }

  async persistSaleEvents(
    items: SaleItemWithPayment[],
    meta: {
      source?: string
      occurredAt?: Date
      customerEmail?: string | null
      customerName?: string | null
      customerPhone?: string | null
      documentType?: string | null
      documentNumber?: string | null
      customerId?: string | null
      actorId?: string | null
      currency?: string
      exchangeRate?: number
      exchangeRateDate?: string | null
      paymentMethod?: string
      paymentDetails?: PaymentDetailInput[]
      total?: number
      discount?: number
      couponId?: string | null
    } = {},
    transactionManager?: EntityManager,
  ) {
    if (!items?.length) return []
    const repo = transactionManager ? transactionManager.getRepository(SaleEvent) : this.saleRepo
    const repoUser = transactionManager ? transactionManager.getRepository(User) : this.userRepo
    const occurredAt = meta.occurredAt ?? new Date()
    const normalizedItems = this.adjustSaleItemsForTotal(items, meta.total, meta.discount)
    const normalizedCodes = normalizedItems
      .map((item) => this.normalizeSaleCode(item.code) ?? this.normalizeSaleCode(item.codes?.[0]))
      .filter((code): code is string => Boolean(code))
    const existingCodes = normalizedCodes.length
      ? new Set(
        (
          await repo.find({
            where: { code: In(normalizedCodes) },
            select: ['code'],
          })
        )
          .map((e) => e.code)
          .filter((c): c is string => Boolean(c)),
      )
      : new Set<string>()

    const seen = new Set<string>(existingCodes)
    const hasCoupon = (meta.discount ?? 0) > 0 || Boolean(meta.couponId)
    const baseSource = meta.source || 'pos'
    const resolvedSource = hasCoupon && !baseSource.includes('coupon') ? `${baseSource}-coupon` : baseSource
    const safeSource = this.trimToLength(resolvedSource, 24) ?? 'pos'
    const safeCustomerEmail = this.trimToLength(meta.customerEmail ?? null, 180)
    const safeCustomerId = this.trimToLength(meta.customerId ?? null, 80)
    const providedExchangeRate = this.parseExchangeRate(meta.exchangeRate)
    const providedExchangeRateDate = this.parseDateKey(meta.exchangeRateDate)
    const resolvedExchangeRate = providedExchangeRate && providedExchangeRateDate
      ? {
        rate: providedExchangeRate,
        date: providedExchangeRateDate,
        source: 'persisted-record',
        lastUpdated: new Date().toISOString(),
        status: 'online' as const,
      }
      : await this.resolveExchangeRateForDate(occurredAt, meta.exchangeRate)
    const eventExchangeRate = resolvedExchangeRate.rate
    const eventExchangeRateDate = resolvedExchangeRate.date
    const allocatedPaymentDetails = this.allocatePaymentDetailsByItem(normalizedItems, meta.paymentDetails, eventExchangeRate)
    const actorRecord = meta.actorId
      ? await repoUser.findOne({ where: { id: meta.actorId }, select: ['id'] })
      : null
    const recordedBy = actorRecord ? ({ id: actorRecord.id } as any) : undefined

    const payloads: Partial<SaleEvent>[] = normalizedItems.map((item, idx) => {
      const primaryCode = this.normalizeSaleCode(item.code) ?? this.normalizeSaleCode(item.codes?.[0])
      if (primaryCode && seen.has(primaryCode)) return null
      if (primaryCode) seen.add(primaryCode)

      const sanitizedCodes = (item.codes ?? [])
        .map((code) => this.normalizeSaleCode(code))
        .filter((code): code is string => Boolean(code))

      const scannedAtRaw = (item as any)?.scannedAt
      const scannedDate = scannedAtRaw ? new Date(scannedAtRaw) : null
      const when = scannedDate && !Number.isNaN(scannedDate.getTime()) ? scannedDate : occurredAt

      const itemPaymentMethod = (item as SaleItemWithPayment).paymentMethod
      const itemPaymentDetails = (item as SaleItemWithPayment).paymentDetails
      const normalizedItemPaymentDetails = this.normalizePaymentDetails(itemPaymentDetails, eventExchangeRate)
      const paymentDetails = normalizedItemPaymentDetails.length
        ? normalizedItemPaymentDetails.map((detail) => this.serializePaymentDetail(detail))
        : allocatedPaymentDetails[idx] ?? null

      return {
        code: this.trimToLength(primaryCode ?? null, 120),
        codes: sanitizedCodes.length ? sanitizedCodes : null,
        name: this.trimToLength(item.name, 180) ?? 'Venta',
        price: this.roundMoney(item.price ?? 0),
        points: typeof item.points === 'number' ? item.points : null,
        exchangeRate: eventExchangeRate ?? undefined,
        exchangeRateDate: eventExchangeRateDate,
        quantity: Math.max(1, Number(item.quantity ?? 1) || 1),
        currency: (this.trimToLength((meta.currency || 'USD').toUpperCase(), 12) ?? 'USD'),
        paymentMethod: this.trimToLength(itemPaymentMethod ?? meta.paymentMethod ?? null, 50),
        paymentDetails,
        source: safeSource,
        productId: this.trimToLength(item.productId ?? null, 80),
        customerEmail: safeCustomerEmail,
        customerName: this.trimToLength(meta.customerName ?? null, 180),
        customerPhone: this.trimToLength(meta.customerPhone ?? null, 50),
        documentType: this.trimToLength(meta.documentType ?? null, 10),
        documentNumber: this.trimToLength(meta.documentNumber ?? null, 30),
        customerId: safeCustomerId,
        occurredAt: when,
        recordedBy,
      } as Partial<SaleEvent>
    }).filter((entry): entry is Partial<SaleEvent> => Boolean(entry))

    if (!payloads.length) return []
    const entities = payloads.map((p) => repo.create(p))
    const saved = await repo.save(entities)
    await this.clearDashboardStats()
    await this.cacheManager.del('sales_events_recent')
    if (meta.customerId) await this.invalidateUserState(meta.customerId)
    return saved
  }

  async getSalesEvents(params: { start?: string; end?: string; limit?: number } = {}) {
    const qb = this.saleRepo.createQueryBuilder('sale').orderBy('sale.occurredAt', 'DESC')
    if (params.start) {
      const startDate = new Date(params.start)
      if (!Number.isNaN(startDate.getTime())) {
        qb.andWhere('sale.occurredAt >= :start', { start: startDate })
      }
    }
    if (params.end) {
      const endDate = new Date(params.end)
      if (!Number.isNaN(endDate.getTime())) {
        qb.andWhere('sale.occurredAt <= :end', { end: endDate })
      }
    }
    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(Number(params.limit), 5000)) : 5000
    qb.take(limit)

    return qb.getMany()
  }

  private async processSaleRewards(
    userId: string,
    pointsAwarded: number,
    manager: EntityManager,
    rules: LoyaltyRulesResponse,
    transactionDate: Date = new Date(),
  ) {
    const repoClaim = manager.getRepository(ProductClaim)
    const repoCoupon = manager.getRepository(Coupon)
    const repoUser = manager.getRepository(User)

    const user = await repoUser.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    const currentTotal = await this.sumClaimedPoints(userId, repoClaim)
    const previousPoints = currentTotal - pointsAwarded
    const updatedPoints = currentTotal

    // 1. Check for Level Rewards (Coupons unlocked by strictly crossing thresholds)
    const rewardsToIssue = (rules.rewardLadder ?? []).filter(
      (step) => previousPoints < step.threshold && updatedPoints >= step.threshold,
    )

    const issuedCoupons: Coupon[] = []
    for (const reward of rewardsToIssue) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + reward.expiresInDays)
      const newCoupon = repoCoupon.create({
        title: reward.title,
        kind: reward.kind,
        threshold: reward.threshold,
        value: reward.value ?? null,
        capUsd: reward.capUsd ?? null,
        status: 'available',
        expiresAt,
        user,
      })
      const saved = await repoCoupon.save(newCoupon)
      issuedCoupons.push(saved)
      await this.logActivity(userId, 'WIN', {
        couponId: newCoupon.id,
        couponTitle: newCoupon.title,
        points: pointsAwarded,
      }, manager, transactionDate)
    }

    // 2. Check for User Level Up
    const levelState = await this.computeAndStoreLevelState(userId, manager, rules)
    if (levelState.levelChanged) {
      await this.logActivity(userId, 'LEVEL_UP', {
        levelName: levelState.currentLevel.name,
        levelId: levelState.currentLevel.id,
      }, manager, transactionDate)
    }

    // 3. Compute Next Threshold
    const next = getNextThreshold(
      updatedPoints,
      rules.firstThreshold,
      rules.thresholdStep,
    )

    return {
      updatedPoints,
      pointsAwarded,
      rewardsUnlocked: issuedCoupons,
      levelState,
      next,
      user,
    }
  }

  private resolveLevel(
    points: number,
    rules: LoyaltyRulesResponse,
  ): { current: LevelDefinition; next: LevelDefinition | null } {
    const fallback = this.buildDefaultRules().levelLadder ?? []
    const source = rules.levelLadder && rules.levelLadder.length ? rules.levelLadder : fallback
    const sorted = [...source].sort((a, b) => a.minPoints - b.minPoints)
    const nonNegative = Math.max(0, points)
    const current = sorted.reduce((acc, level) => (nonNegative >= level.minPoints ? level : acc), sorted[0])
    const next = sorted.find((level) => nonNegative < level.minPoints) ?? null
    return { current, next }
  }

  private async issueMonthlyLevelCoupons(
    user: User,
    level: LevelDefinition,
    manager: EntityManager,
    rules: LoyaltyRulesResponse,
  ): Promise<Coupon[]> {
    const repoCoupon = manager.getRepository(Coupon)
    const packs = level.perks.monthlyCoupons ?? []
    if (!packs.length) return []

    const now = new Date()
    const renewDay = Math.max(1, level.perks.monthlyCouponRenewDay ?? rules.levelMonthlyCouponRenewDay ?? 1)
    const startOfWindow = new Date(now.getFullYear(), now.getMonth(), renewDay)
    const endOfWindow = new Date(now.getFullYear(), now.getMonth() + 1, renewDay)
    const monthKey = `${startOfWindow.getFullYear()}-${String(startOfWindow.getMonth() + 1).padStart(2, '0')}`

    const existing = await repoCoupon
      .createQueryBuilder('coupon')
      .where('coupon.user_id = :userId', { userId: user.id })
      .andWhere('coupon.created_at >= :start', { start: startOfWindow })
      .andWhere('coupon.created_at < :end', { end: endOfWindow })
      .andWhere('coupon.title LIKE :monthKey', { monthKey: `%${monthKey}%` })
      .getMany()

    const expiryDays = level.perks.monthlyCouponExpiryDays ?? rules.levelMonthlyCouponExpiryDays ?? 14
    const issued: Coupon[] = []

    for (const pack of packs) {
      const existingForPack = existing.filter((c) => c.value === pack.percent)
      const missing = Math.max(0, pack.quantity - existingForPack.length)
      if (missing <= 0) continue

      for (let i = 0; i < missing; i++) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expiryDays)

        const coupon = repoCoupon.create({
          title: `Cupon mensual ${pack.percent}% - ${level.name} (${monthKey})`,
          kind: 'percent',
          value: pack.percent,
          threshold: null,
          capUsd: null,
          status: 'available',
          expiresAt,
          user,
        })
        const saved = await repoCoupon.save(coupon)
        issued.push(saved)
        await this.logActivity(user.id, 'WIN', {
          couponId: saved.id,
          couponTitle: saved.title,
          kind: 'level',
        }, manager, saved.createdAt ?? new Date())
      }
    }

    return issued
  }

  async updateProfile(userId: string, data: { phone?: string; cedula?: string; name?: string; hasSeenWelcome?: boolean; hasSeenFirstCoupon?: boolean; lastGiftSeenAt?: string | null }) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) {
      throw new Error('Usuario no encontrado')
    }
    // Only update if phone is provided (even if empty string to clear it)
    if (data.phone !== undefined) {
      user.phoneNumber = data.phone
    }
    if (data.cedula !== undefined) {
      if (data.cedula) {
        const existing = await this.userRepo.findOne({ where: { cedula: data.cedula } })
        if (existing && existing.id !== userId) {
          throw new BadRequestException('Esta c├®dula ya est├í registrada por otro usuario')
        }
      }
      user.cedula = data.cedula
    }
    if (data.name !== undefined) {
      user.name = data.name
    }
    if (data.hasSeenWelcome !== undefined) {
      user.hasSeenWelcome = data.hasSeenWelcome
    }
    if (data.hasSeenFirstCoupon !== undefined) {
      user.hasSeenFirstCoupon = data.hasSeenFirstCoupon
    }
    if (data.lastGiftSeenAt !== undefined) {
      if (data.lastGiftSeenAt === null) {
        user.lastGiftSeenAt = null
      } else {
        const parsed = new Date(data.lastGiftSeenAt)
        if (!Number.isNaN(parsed.getTime())) {
          user.lastGiftSeenAt = parsed
        }
      }
    }
    await this.userRepo.save(user)
    await this.invalidateUserState(userId)
    return { message: 'Perfil actualizado' }
  }

  private async computeAndStoreLevelState(
    userId: string,
    manager?: EntityManager,
    rules?: LoyaltyRulesResponse,
  ): Promise<{
    currentLevel: LevelDefinition
    nextLevel: LevelDefinition | null
    pointsInWindow: number
    windowStart: Date
    windowEnd: Date
    expiresAt: Date | null
    awardedAt: Date
    pointsToNext: number | null
    levelChanged: boolean
    previousLevelId: string | null
    couponsIssued?: Coupon[]
  }> {
    const repoClaim = manager?.getRepository(ProductClaim) ?? this.claimRepo
    const repoLevel = manager?.getRepository(UserLevel) ?? this.userLevelRepo
    const repoUser = manager?.getRepository(User) ?? this.userRepo

    const user = await repoUser.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    const pointsTotal = await this.sumClaimedPoints(userId, repoClaim)
    const activeRules = rules ?? await this.getActiveRules(manager)
    const { current, next } = this.resolveLevel(pointsTotal, activeRules)

    let record = await repoLevel.findOne({ where: { user: { id: userId } }, relations: ['user'] })
    const previousLevelId = record?.levelId ?? null
    const levelChanged = !record || record?.levelId !== current.id
    const now = new Date()
    const awardedAt = levelChanged ? now : record?.awardedAt ?? user.createdAt ?? now
    const windowStart = user.createdAt ?? new Date(0)
    const windowEnd = now
    const expiresAt: Date | null = null

    if (!record) {
      record = repoLevel.create({
        user,
        levelId: current.id,
        pointsInWindow: pointsTotal,
        windowStart,
        windowEnd,
        awardedAt,
        expiresAt,
      })
    } else {
      repoLevel.merge(record, {
        levelId: current.id,
        pointsInWindow: pointsTotal,
        windowStart,
        windowEnd,
        awardedAt,
        expiresAt,
      })
    }
    await repoLevel.save(record)
    const couponsIssued = await this.issueMonthlyLevelCoupons(
      user,
      current,
      manager ?? this.dataSource.manager,
      activeRules,
    )

    return {
      currentLevel: current,
      nextLevel: next,
      pointsInWindow: pointsTotal,
      windowStart,
      windowEnd,
      expiresAt,
      awardedAt,
      pointsToNext: next ? Math.max(next.minPoints - pointsTotal, 0) : null,
      levelChanged,
      previousLevelId,
      couponsIssued,
    }
  }

  private mapCouponForResponse(coupon: Coupon) {
    // Once a coupon is used, its expiration should no longer matter
    const expiresAt = coupon.status === 'used' ? null : coupon.expiresAt ?? null

    return {
      id: coupon.id,
      title: coupon.title,
      kind: coupon.kind,
      threshold: coupon.threshold ?? null,
      value: coupon.value ?? null,
      capUsd: coupon.capUsd ?? null,
      status: coupon.status,
      expiresAt,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
      usedAt: coupon.usedAt ?? null,
      verifiedBy: coupon.verifiedBy ? { id: coupon.verifiedBy.id, email: coupon.verifiedBy.email, cedula: coupon.verifiedBy.cedula ?? null } : null,
    }
  }

  async verifyClaims(codes: string[]) {
    if (!codes || codes.length === 0) return []
    // Use chunks to avoid parameter limit issues if many codes (e.g. SQLite has 999 limit, Postgres higher but safe to batch)
    const chunkSize = 500
    const validCodes: string[] = []

    for (let i = 0; i < codes.length; i += chunkSize) {
      const chunk = codes.slice(i, i + chunkSize)
      const claims = await this.claimRepo.find({
        select: ['code'],
        where: { code: In(chunk) },
      })
      validCodes.push(...claims.map((c) => c.code))
    }

    return validCodes
  }

  async getRules() {
    return this.getActiveRules()
  }

  async lookupUser(dto: LookupUserDto) {
    const trimmed = dto.email?.trim()
    const normalizedEmail = trimmed?.toLowerCase()
    const normalizedCedula = dto.cedula?.replace(/\D/g, '')
    if (!normalizedEmail && !normalizedCedula) {
      throw new BadRequestException('Debes enviar c├®dula o correo')
    }

    let user =
      (normalizedCedula && await this.userRepo.findOne({ where: { cedula: normalizedCedula } })) ||
      (normalizedEmail && await this.userRepo.findOne({ where: { email: normalizedEmail } })) ||
      (trimmed && trimmed !== normalizedEmail
        ? await this.userRepo.findOne({ where: { email: trimmed } })
        : null)

    if (this.isExpiredProvisionalUser(user)) {
      await this.cleanupExpiredProvisionalUsers()
      user = null
    }

    if (!user) {
      throw new NotFoundException('Cliente no encontrado')
    }

    const state = await this.getUserState(user.id)
    return state
  }

  async claimProduct(code: string, userId: string) {
    try {
      const claim = await this.claimRepo.findOne({ where: { code } })
      if (!claim) {
        throw new NotFoundException('C├│digo no encontrado')
      }
      if (claim.status === 'claimed') {
        throw new BadRequestException('Este c├│digo ya fue usado')
      }
      const rules = await this.getActiveRules()
      const claimPoints =
        typeof claim.points === 'number' && !Number.isNaN(claim.points)
          ? claim.points
          : rules.pointsPerProduct

      return this.dataSource.transaction(async (manager) => {
        const repoClaim = manager.getRepository(ProductClaim)
        const repoCoupon = manager.getRepository(Coupon)
        const repoUser = manager.getRepository(User)

        const user = await repoUser.findOne({ where: { id: userId } })
        if (!user) {
          throw new NotFoundException('Usuario no encontrado')
        }

        const previousPoints = await this.sumClaimedPoints(userId, repoClaim)

        if (claim.productId) {
          await this.decrementProductStock([{
            name: claim.productName || 'Producto',
            price: claim.price ?? 0,
            points: claimPoints,
            productId: claim.productId,
            quantity: 1,
          }], manager)
        }

        await repoClaim.update(
          { id: claim.id },
          { status: 'claimed', claimedBy: user, claimedAt: new Date(), points: claimPoints },
        )

        const updatedPoints = previousPoints + claimPoints
        const rewardsToIssue = (rules.rewardLadder ?? []).filter(
          (step) => previousPoints < step.threshold && updatedPoints >= step.threshold,
        )
        const issuedCoupons: Coupon[] = []

        for (const reward of rewardsToIssue) {
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + reward.expiresInDays)
          const newCoupon = repoCoupon.create({
            title: reward.title,
            kind: reward.kind,
            threshold: reward.threshold,
            value: reward.value ?? null,
            capUsd: reward.capUsd ?? null,
            status: 'available',
            expiresAt,
            user,
          })
          const saved = await repoCoupon.save(newCoupon)
          issuedCoupons.push(saved)

          await this.logActivity(userId, 'WIN', {
            couponId: newCoupon.id,
            couponTitle: newCoupon.title,
            points: claimPoints,
          }, manager, new Date())
        }

        const levelState = await this.computeAndStoreLevelState(userId, manager, rules)

        if (levelState.levelChanged) {
          await this.logActivity(userId, 'LEVEL_UP', {
            levelName: levelState.currentLevel.name,
            levelId: levelState.currentLevel.id,
          }, manager, new Date())
        }
        const next = getNextThreshold(
          updatedPoints,
          rules.firstThreshold,
          rules.thresholdStep,
        )

        return {
          totalPoints: updatedPoints,
          nextThreshold: next,
          pointsAwarded: claimPoints,
          rewardsUnlocked: issuedCoupons.map((c) => this.mapCouponForResponse(c)),
          rewardUnlocked: issuedCoupons.length
            ? this.mapCouponForResponse(issuedCoupons[issuedCoupons.length - 1])
            : null,
          levelCouponsIssued: levelState.couponsIssued?.map((c) => this.mapCouponForResponse(c)) ?? [],
          levelState,
        }
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('claimProduct error', e)
      if (e instanceof HttpException) {
        throw e
      }
      throw new InternalServerErrorException('Error al reclamar')
    }
  }

  async registerSale(dto: RegisterSaleDto, actorId: string) {
    try {
      const items = dto.items ?? []
      if (!items.length) {
        throw new BadRequestException('Debes enviar al menos un producto')
      }

      const normalizedEmail = dto.customerEmail?.trim().toLowerCase()
      const trimmedEmail = dto.customerEmail?.trim()
      const normalizedCedula = (dto.customerCedula || dto.documentNumber)?.replace(/\D/g, '') || null

      let user =
        (dto.customerId && await this.userRepo.findOne({ where: { id: dto.customerId } })) ||
        (normalizedCedula && await this.userRepo.findOne({ where: { cedula: normalizedCedula } })) ||
        (normalizedEmail && await this.userRepo.findOne({ where: { email: normalizedEmail } })) ||
        (trimmedEmail && trimmedEmail !== normalizedEmail
          ? await this.userRepo.findOne({ where: { email: trimmedEmail } })
          : null)

      if (this.isExpiredProvisionalUser(user)) {
        await this.cleanupExpiredProvisionalUsers()
        user = null
      }

      if (!user && dto.customerId) {
        throw new NotFoundException('Cliente no encontrado')
      }

      if (!user) {
        if (!normalizedCedula) {
          throw new BadRequestException('La cedula es obligatoria para registrar una venta no registrada')
        }
        user = await this.getOrCreateProvisionalUser({
          cedula: normalizedCedula,
          email: normalizedEmail,
          name: dto.customerName,
          phone: dto.customerPhone,
        })
      }

      const rules = await this.getActiveRules()

      const outcome = await this.dataSource.transaction(async (manager) => {
        const repoClaim = manager.getRepository(ProductClaim)
        const repoCoupon = manager.getRepository(Coupon)
        const now = new Date()
        const saleItems = await this.hydrateSaleItemsWithCatalog(items, manager, {
          requireActive: true,
          checkStock: true,
        })

        const coupon = dto.couponId
          ? await repoCoupon.findOne({ where: { id: dto.couponId } })
          : null
        const shouldBlock = this.isPointsBlockingCoupon(coupon)
        const capUsd = Number(coupon?.capUsd ?? 0)
        const coverage = shouldBlock
          ? this.computeCouponCoverage(saleItems, capUsd)
          : Array.from({ length: saleItems.length }, () => 0)
        const adjustedItems = this.adjustSaleItemsForTotal(saleItems, dto.total, dto.discount)

        let pointsAwarded = 0

        for (const [idx, item] of saleItems.entries()) {
          const qtyRaw = typeof item.quantity === 'number' && !Number.isNaN(item.quantity) ? item.quantity : 1
          const quantity = Math.max(1, Math.round(qtyRaw))
          const coveredUnits = Math.max(0, Math.min(quantity, Number(coverage[idx] ?? 0) || 0))
          const eligibleUnits = Math.max(0, quantity - coveredUnits)
          // SECURITY: Only use client-provided points if the user is authorized (Controller handles this guard).
          const perUnitPoints = item.points ?? rules.pointsPerProduct
          const awarded = Math.max(0, perUnitPoints * eligibleUnits)

          // Anti-abuse: Cap max points per item line to prevent overflow or logic errors
          if (awarded > 5000) {
            throw new BadRequestException('Puntos por ítem exceden el límite de seguridad')
          }
          pointsAwarded += awarded

          const shouldCreateClaim = awarded > 0 || perUnitPoints === 0
          if (!shouldCreateClaim) continue

          const candidatePrice = Number(adjustedItems[idx]?.price ?? item.price ?? 0)
          const price = Number.isFinite(candidatePrice) ? candidatePrice : 0

          const params = new URLSearchParams()
          const safeName = (item.name || 'Venta').trim().slice(0, 60) || 'Venta'
          params.set('name', safeName)
          params.set('points', awarded.toString())
          params.set('price', price.toString())
          const claimQty = perUnitPoints === 0 ? quantity : eligibleUnits
          params.set('qty', claimQty.toString())
          const code = `sale://${randomUUID()}-${idx}?${params.toString()}`

          const claim = repoClaim.create({
            code,
            status: 'claimed',
            points: awarded,
            claimedBy: user,
            claimedAt: now,
          })
          await repoClaim.save(claim)
        }

        const rewardsResult = await this.processSaleRewards(user.id, pointsAwarded, manager, rules, now)
        await this.decrementProductStock(saleItems, manager)

        const saleEvents = await this.persistSaleEvents(saleItems, {
          source: 'register',
          occurredAt: now,
          customerEmail: user.email,
          customerName: dto.customerName || null,
          customerPhone: dto.customerPhone || null,
          documentType: dto.documentType || null,
          documentNumber: normalizedCedula || (dto as any).documentNumber || null,
          customerId: user.id,
          actorId,
          exchangeRate: dto.exchangeRate,
          paymentMethod: dto.paymentMethod,
          paymentDetails: dto.paymentDetails,
          total: dto.total,
          discount: dto.discount,
          couponId: dto.couponId ?? null,
        }, manager)

        return {
          updatedPoints: rewardsResult.updatedPoints,
          pointsAwarded: rewardsResult.pointsAwarded,
          rewardsUnlocked: rewardsResult.rewardsUnlocked.map((c) => this.mapCouponForResponse(c)),
          rewardUnlocked: rewardsResult.rewardsUnlocked.length
            ? this.mapCouponForResponse(rewardsResult.rewardsUnlocked[rewardsResult.rewardsUnlocked.length - 1])
            : null,
          levelCouponsIssued: rewardsResult.levelState.couponsIssued?.map((c) => this.mapCouponForResponse(c)) ?? [],
          levelState: rewardsResult.levelState,
          user: {
            id: user.id,
            email: user.email,
            cedula: user.cedula ?? null,
            isProvisional: user.isProvisional,
            provisionalExpiresAt: user.provisionalExpiresAt ?? null,
          },
          saleEvents,
          next: rewardsResult.next,
        }
      })

      const state = await this.getUserState(outcome.user.id)

      return {
        ok: true,
        totalPoints: outcome.updatedPoints,
        pointsAwarded: outcome.pointsAwarded,
        nextThreshold: outcome.next,
        rewardsUnlocked: outcome.rewardsUnlocked,
        rewardUnlocked: outcome.rewardUnlocked,
        levelCouponsIssued: outcome.levelCouponsIssued,
        levelState: outcome.levelState,
        user: outcome.user,
        saleEvents: outcome.saleEvents,
        state,
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('registerSale error', e)
      if (e instanceof HttpException) {
        throw e
      }
      throw new InternalServerErrorException('Error al registrar venta')
    }
  }

  async redeemCoupon(couponId: string, verifierId: string) {
    try {
      const coupon = await this.couponRepo.findOne({
        where: { id: couponId },
        relations: ['user'],
      })
      if (!coupon) throw new NotFoundException('Cup├│n no encontrado')
      if (coupon.status === 'used') {
        return { ok: false, status: 'used', message: 'El cup├│n ya fue canjeado' }
      }
      if (coupon.status !== 'available') {
        return { ok: false, status: coupon.status, message: 'El cup├│n no est├í disponible' }
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        await this.couponRepo.update({ id: couponId }, { status: 'expired' })
        return { ok: false, status: 'expired', message: 'El cup├│n est├í expirado' }
      }

      return this.dataSource.transaction(async (manager) => {
        const repoCoupon = manager.getRepository(Coupon)
        const repoUser = manager.getRepository(User)
        const verifier = await repoUser.findOne({ where: { id: verifierId } })
        if (!verifier) throw new NotFoundException('Verificador no encontrado')

        await repoCoupon.update(
          { id: couponId },
          { status: 'used', usedAt: new Date(), verifiedBy: verifier, expiresAt: null },
        )

        await this.logActivity(coupon.user!.id, 'USE', {
          couponId: coupon.id,
          couponTitle: coupon.title,
          verifierName: verifier.email,
        }, manager, new Date())

        return { ok: true, couponId, status: 'used' }
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('redeemCoupon error', e)
      if (e instanceof HttpException) {
        throw e
      }
      throw new InternalServerErrorException('Error al canjear cup├│n')
    }
  }

  async transferCoupon(couponId: string, recipientEmail: string, requesterId: string) {
    try {
      const normalizedEmail = recipientEmail?.trim().toLowerCase()
      if (!normalizedEmail) {
        throw new BadRequestException('Correo requerido')
      }

      return this.dataSource.transaction(async (manager) => {
        const repoCoupon = manager.getRepository(Coupon)
        const repoUser = manager.getRepository(User)

        const coupon = await repoCoupon.findOne({
          where: { id: couponId },
          relations: ['user'],
        })
        if (!coupon) throw new NotFoundException('Cupon no encontrado')
        if (!coupon.user || coupon.user.id !== requesterId) {
          throw new ForbiddenException('No puedes transferir este cupon')
        }
        if (coupon.status !== 'available') {
          throw new BadRequestException('El cupon no esta disponible')
        }
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          await repoCoupon.update({ id: couponId }, { status: 'expired' })
          throw new BadRequestException('El cupon esta expirado')
        }

        const recipient =
          (await repoUser.findOne({ where: { email: normalizedEmail } })) ??
          (normalizedEmail !== recipientEmail.trim()
            ? await repoUser.findOne({ where: { email: recipientEmail.trim() } })
            : null)
        if (!recipient) {
          throw new NotFoundException('El destinatario no existe')
        }
        if (recipient.id === requesterId) {
          throw new BadRequestException('No puedes enviarte el cupon')
        }

        const requester = await repoUser.findOne({ where: { id: requesterId } })

        await repoCoupon.update({ id: couponId }, { user: recipient, verifiedBy: null })

        const transferDate = new Date()
        // Log for Sender
        await this.logActivity(requesterId, 'SEND', {
          couponId: coupon.id,
          couponTitle: coupon.title,
          peerName: recipient.email,
          peerId: recipient.id,
        }, manager, transferDate)

        // Log for Recipient
        await this.logActivity(recipient.id, 'RECEIVE', {
          couponId: coupon.id,
          couponTitle: coupon.title,
          peerName: requester?.email || 'Alguien',
          peerId: requesterId,
        }, manager, transferDate)

        await this.invalidateUserState(requesterId)
        await this.invalidateUserState(recipient.id)

        return {
          ok: true,
          couponId,
          to: { id: recipient.id, email: recipient.email },
          status: 'available',
        }
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('transferCoupon error', e)
      if (e instanceof HttpException) {
        throw e
      }
      throw new InternalServerErrorException('Error al transferir cupon')
    }
  }

  async inspectCoupon(couponId: string) {
    try {
      const coupon = await this.couponRepo.findOne({
        where: { id: couponId },
        relations: ['user', 'verifiedBy'],
      })
      if (!coupon) throw new NotFoundException('Cupon no encontrado')

      const progress = coupon.user?.id ? await this.getUserState(coupon.user.id) : null
      const briefHistory = progress
        ? {
          totalPoints: progress.totalPoints,
          nextThreshold: progress.nextThreshold,
          levelState: progress.levelState ?? null,
          coupons: progress.coupons.slice(0, 4),
        }
        : null

      return {
        coupon: this.mapCouponForResponse(coupon),
        owner: coupon.user ? { id: coupon.user.id, email: coupon.user.email, cedula: coupon.user.cedula ?? null } : null,
        progress: briefHistory,
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('inspectCoupon error', e)
      if (e instanceof HttpException) {
        throw e
      }
      throw new InternalServerErrorException(e.message || 'Error al revisar cupon')
    }
  }

  async getUserState(userId: string) {
    try {
      if (!isUUID(userId)) {
        throw new BadRequestException('ID de usuario inv├ílido')
      }

      const user = await this.userRepo.findOne({ where: { id: userId } })
      if (!user) {
        throw new NotFoundException('Usuario no encontrado')
      }
      if (this.isExpiredProvisionalUser(user)) {
        await this.cleanupExpiredProvisionalUsers()
        throw new NotFoundException('Usuario no encontrado')
      }

      const cacheKey = `user_state_${userId}`
      const cached = await this.cacheManager.get(cacheKey)
      if (cached) {
        return {
          ...(cached as any),
          user: {
            ...((cached as any)?.user ?? {}),
            ...this.sanitizeUser(user),
          },
        }
      }

      const rules = await this.getActiveRules()
      const totalPoints = await this.sumClaimedPoints(user.id)
      const coupons = await this.couponRepo.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
        relations: ['verifiedBy'],
      })
      const levelState = await this.computeAndStoreLevelState(user.id, undefined, rules)
      const normalizedCoupons = coupons.map((c) => this.mapCouponForResponse(c))

      const activity = await this.activityRepo.find({
        where: { user: { id: user.id } },
        order: { createdAt: 'DESC' },
        take: 50,
      })

      const claims = await this.claimRepo.find({
        where: { claimedBy: { id: user.id }, status: 'claimed' },
        order: { claimedAt: 'DESC' },
        take: 50,
      })

      const next = getNextThreshold(
        totalPoints,
        rules.firstThreshold,
        rules.thresholdStep,
      )
      const result = {
        totalPoints,
        nextThreshold: next,
        coupons: normalizedCoupons,
        levelState,
        activity,
        claims: claims.map(c => ({
          id: c.id,
          code: c.code,
          points: c.points,
          claimedAt: c.claimedAt,
          status: c.status
        })),
        user: {
          id: user.id,
          email: user.email,
          cedula: user.cedula ?? null,
          phoneNumber: user.phoneNumber ?? null,
          name: user.name ?? null,
          lastGiftSeenAt: user.lastGiftSeenAt ?? null,
          role: user.role,
          createdAt: user.createdAt,
          isProvisional: user.isProvisional,
          provisionalExpiresAt: user.provisionalExpiresAt ?? null,
        },
      }
      await this.cacheManager.set(cacheKey, result, 300000) // 5 minutes
      return result
    } catch (e: any) {
      if (e instanceof HttpException) {
        throw e
      }
      // eslint-disable-next-line no-console
      console.error('getUserState error', e)
      throw new InternalServerErrorException(e.message || 'Error al obtener estado')
    }
  }

  async generateClaims(
    count: number,
    persist: boolean = false,
    prefix?: string,
    points?: number,
    productMeta?: { productId?: string; productName?: string; price?: number },
  ) {
    const normalizedPrefix = prefix?.trim() ?? ''
    const rules = await this.getActiveRules()
    const product = productMeta?.productId
      ? await this.productRepo.findOne({ where: { id: productMeta.productId } })
      : null
    if (productMeta?.productId && !product) {
      throw new BadRequestException('Producto no encontrado en el catalogo')
    }
    if (product && !product.active) {
      throw new BadRequestException('No puedes generar codigos para un producto oculto')
    }
    const claimPoints =
      product
        ? Number(product.points ?? 0)
        : typeof points === 'number' && !Number.isNaN(points) ? points : rules.pointsPerProduct
    const claimPrice = product ? product.price : productMeta?.price
    const claimProductName = product ? product.name : productMeta?.productName
    const claims = Array.from({ length: count }).map(() => {
      const code = `${normalizedPrefix}${randomUUID()}`
      return this.claimRepo.create({
        code,
        status: 'available',
        points: claimPoints,
        productId: product?.id ?? productMeta?.productId ?? null,
        productName: claimProductName ?? null,
        price: typeof claimPrice === 'number' && Number.isFinite(claimPrice)
          ? this.roundMoney(claimPrice)
          : null,
      })
    })

    if (persist) {
      await this.claimRepo.save(claims)
    }

    return {
      created: claims.length,
      persisted: persist,
      sample: claims.slice(0, 5).map((c) => c.code),
      codes: count <= 200 ? claims.map((c) => c.code) : undefined,
    }
  }

  async clearClaims(codes?: string[]) {
    try {
      const hasCodes = Array.isArray(codes) && codes.length > 0
      // If specific codes are provided, delete them regardless of status (used or available).
      // Otherwise keep the original behaviour of clearing only available codes.
      const where: any = hasCodes ? { code: In(codes) } : { status: 'available' as ProductClaimStatus }
      const result = await this.claimRepo.delete(where)
      return { deleted: result.affected ?? 0 }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('clearClaims error', e)
      throw new InternalServerErrorException('No se pudieron borrar los QR disponibles')
    }
  }

  async countActiveUsers() {
    const total = await this.userRepo.count()
    return { activeUsers: total }
  }

  async getCouponStats() {
    const rows = await this.couponRepo
      .createQueryBuilder('coupon')
      .select('coupon.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('coupon.status')
      .getRawMany<{ status: CouponStatus; count: string | number }>()

    const base = { available: 0, used: 0, expired: 0, total: 0 }
    for (const row of rows) {
      const count = typeof row.count === 'string' ? Number(row.count) : Number(row.count ?? 0)
      const safeCount = Number.isFinite(count) ? count : 0
      if (row.status === 'available') base.available += safeCount
      if (row.status === 'used') base.used += safeCount
      if (row.status === 'expired') base.expired += safeCount
      base.total += safeCount
    }
    return base
  }

  async logActivity(
    userId: string,
    type: ActivityType,
    data: Record<string, any>,
    manager?: EntityManager,
    date?: Date,
  ) {
    const repo = manager ? manager.getRepository(UserActivity) : this.activityRepo
    const repoUser = manager ? manager.getRepository(User) : this.userRepo

    const user = await repoUser.findOne({ where: { id: userId }, select: ['id', 'role'] })
    if (!user || user.role !== 'client') return

    await repo.save({
      user: { id: userId },
      type,
      data,
      createdAt: date ?? new Date(),
    })
  }

  async deleteUser(userId: string) {
    try {
      return this.dataSource.transaction(async (manager) => {
        const repoUser = manager.getRepository(User)

        // Check if user exists
        const existing = await repoUser.findOne({ where: { id: userId } })
        if (!existing) {
          throw new NotFoundException('Usuario no encontrado')
        }

        // The database schema is configured with ON DELETE CASCADE for:
        // - Coupons (user_id)
        // - UserLevel (user_id)
        // - ProductClaim (claimed_by)
        // - UserActivity (user_id)
        // 
        // And ON DELETE SET NULL for:
        // - Coupons (verified_by)

        // Therefore, we only need to delete the user.
        const result = await repoUser.delete({ id: userId })
        return { deleted: result.affected ?? 0 }
      })
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('deleteUser error', e)
      if (e instanceof HttpException) throw e
      throw new InternalServerErrorException('No se pudo borrar el usuario')
    }
  }
  async getExchangeRate() {
    const todayKey = this.getCaracasDateKey()
    const cacheKey = `exchange_rate_data_${todayKey}`
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached as { rate: number; date: string; source: string; lastUpdated: string; status: 'online' | 'offline' }

    const live = await this.fetchCurrentExchangeRateFromProviders()
    if (live?.rate) {
      const record = await this.persistExchangeRate(todayKey, live.rate, live.source)
      const result = {
        rate: live.rate,
        date: todayKey,
        source: record?.source ?? live.source,
        sourceDate: live.sourceDate,
        lastUpdated: record?.fetchedAt?.toISOString?.() ?? new Date().toISOString(),
        status: 'online' as const,
      }
      await this.cacheManager.set(cacheKey, result, 3600000)
      return result
    }

    const persisted = await this.exchangeRateRepo.findOne({ where: { date: todayKey } })
    if (persisted) {
      const result = this.mapExchangeRateRecord(persisted, 'offline')
      await this.cacheManager.set(cacheKey, result, 300000)
      return result
    }

    return {
      rate: 0,
      date: todayKey,
      source: 'unavailable',
      lastUpdated: new Date().toISOString(),
      status: 'offline' as const,
    }
  }

  async getAdminDashboardStats() {
    const cacheKey = 'admin_dashboard_stats'
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached as any

    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)

    const [
      registeredUsers,
      newUsersToday,
      totalCoupons,
      redeemedCoupons,
      couponsWeek,
      logins,
      scans,
      redeems,
      dailyUsers,
      weeklyUsers,
      dailyActivity,
      couponHistory,
      levelDistribution
    ] = await Promise.all([
      this.userRepo.count({ where: { role: 'client' } }),
      this.userRepo.count({ where: { role: 'client', createdAt: MoreThanOrEqual(todayStart) } }),
      this.couponRepo.count(),
      this.couponRepo.count({ where: { status: 'used' } }),
      this.couponRepo.count({ where: { usedAt: MoreThanOrEqual(weekStart) } }),
      this.activityRepo.count({ where: { type: 'LOGIN' } }),
      this.claimRepo.count({ where: { status: 'claimed' } }),
      this.activityRepo.count({ where: { type: 'USE' } }),
      this.getDailyUserRegistrations(60),
      Promise.resolve([]), // Removed weekly users
      this.getDailyActivity(60),
      this.getDailyCouponUsage(60),
      this.getLevelDistribution(),
    ])

    const exchangeRateData = await this.getExchangeRate()

    const stats = {
      registeredUsers,
      newUsersToday,
      totalCoupons, // Generated
      redeemedCoupons,
      couponsWeek,
      interactions: {
        total: logins + scans + redeems,
        logins,
        scans,
        redeems,
      },
      couponsGenerated: totalCoupons,
      userGrowth: {
        daily: dailyUsers,
        weekly: weeklyUsers,
      },
      activityHistory: dailyActivity,
      couponHistory: couponHistory,
      levelDistribution,
      apiStatus: {
        ok: exchangeRateData.status === 'online',
        rate: exchangeRateData.rate,
        lastCheck: exchangeRateData.lastUpdated
      }
    }
    await this.cacheManager.set(cacheKey, stats, 120000) // 2 minutes
    return stats
  }

  // --- Chart Helpers ---

  private async getDailyUserRegistrations(days: number) {
    // Returns array of last N days with count
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    // Postgres specific: date_trunc('day', created_at)
    const res = await this.userRepo
      .createQueryBuilder('user')
      .select("to_char(date_trunc('day', user.created_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.created_at >= :cutoff', { cutoff })
      .andWhere("user.role = 'client'")
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany()

    return res.map(r => ({ date: r.date, count: Number(r.count) }))
  }

  private async getWeeklyUserRegistrations(weeks: number) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - (weeks * 7))

    const res = await this.userRepo
      .createQueryBuilder('user')
      .select("to_char(date_trunc('week', user.created_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.created_at >= :cutoff', { cutoff })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany()

    return res.map(r => ({ date: r.date, count: Number(r.count) }))
  }

  private async getDailyActivity(days: number) {
    // We want last N days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const res = await this.activityRepo
      .createQueryBuilder('act')
      .innerJoin('act.user', 'user')
      .select("to_char(date_trunc('day', act.created_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('act.created_at >= :cutoff', { cutoff })
      .andWhere("user.role = 'client'")
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany()

    return res.map(r => ({ date: r.date, count: Number(r.count) }))
  }

  private async getDailyCouponUsage(days: number) {
    // We need Created vs Redeemed by day.

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    // 1. Created (Generated)
    const created = await this.couponRepo
      .createQueryBuilder('c')
      .select("to_char(date_trunc('day', c.created_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where('c.created_at >= :cutoff', { cutoff })
      .groupBy('date')
      .getRawMany()

    // 2. Used (Redeemed) - filter by usedAt
    const redeemed = await this.couponRepo
      .createQueryBuilder('c')
      .select("to_char(date_trunc('day', c.used_at), 'YYYY-MM-DD')", 'date')
      .addSelect('COUNT(*)', 'count')
      .where("c.used_at IS NOT NULL")
      .andWhere('c.used_at >= :cutoff', { cutoff })
      .groupBy('date')
      .getRawMany()

    // Merge
    const map = new Map<string, { created: number; redeemed: number }>()

    // Initialize last N weeks to 0? Or just return what we have? 
    // Let's just return what we have, frontend handles gaps or we can fill.
    // For simpler query, just map what exists.

    created.forEach(r => {
      const d = r.date;
      if (!map.has(d)) map.set(d, { created: 0, redeemed: 0 });
      map.get(d)!.created = Number(r.count);
    })

    redeemed.forEach(r => {
      const d = r.date;
      if (!map.has(d)) map.set(d, { created: 0, redeemed: 0 });
      map.get(d)!.redeemed = Number(r.count);
    })

    // Sort by date
    const result = Array.from(map.entries()).map(([date, counts]) => ({ date, ...counts }))
    result.sort((a, b) => a.date.localeCompare(b.date))
    return result;
  }


  private async getLevelDistribution() {
    const rules = await this.getActiveRules()
    const raw = await this.userLevelRepo
      .createQueryBuilder('ul')
      .select('ul.levelId', 'levelId')
      .addSelect('COUNT(*)', 'count')
      .innerJoin('ul.user', 'user')
      .where("user.role = 'client'")
      .groupBy('ul.levelId')
      .getRawMany()

    const map = new Map<string, number>()
    let assignedCount = 0
    raw.forEach((r) => {
      const c = Number(r.count)
      map.set(r.levelId, c)
      assignedCount += c
    })

    const totalUsers = await this.userRepo.count({ where: { role: 'client' } })
    const unassigned = Math.max(0, totalUsers - assignedCount)

    const fallback = this.buildDefaultRules().levelLadder ?? []
    const source = rules.levelLadder && rules.levelLadder.length ? rules.levelLadder : fallback
    const sortedLadder = [...source].sort((a, b) => a.minPoints - b.minPoints)
    const lowest = sortedLadder[0]?.id

    return sortedLadder.map((l) => {
      let count = map.get(l.id) || 0
      if (l.id === lowest) count += unassigned
      return { name: l.name, count }
    })
  }


  // --- TICKETS ---

  async createGuestTicket(data: any) {
    let user: User | null = null
    const email = data.customerEmail?.trim().toLowerCase()
    const cedula = (data.documentNumber || data.customerCedula)?.replace(/\D/g, '') || null

    // 1. Try to find existing user
    if (cedula) user = await this.userRepo.findOne({ where: { cedula } })
    if (!user && email) user = await this.userRepo.findOne({ where: { email } })

    if (this.isExpiredProvisionalUser(user)) {
      await this.cleanupExpiredProvisionalUsers()
      user = null
    }

    // 2. If not found, create Provisional
    if (!user) {
      if (!cedula && !email) {
        throw new BadRequestException("La c├®dula o el correo electr├│nico son requeridos para registrar el pedido.")
      }

      user = await this.getOrCreateProvisionalUser({
        cedula,
        email,
        name: data.customerName,
        phone: data.phone || data.customerPhone,
      })
    }

    // 3. Create Ticket linked to user
    // Ensure data has the right fields for Ticket entity mapping
    const ticketData = {
      ...data,
      phone: data.phone || data.customerPhone,
      documentNumber: (data.documentNumber || data.customerCedula)?.replace(/\D/g, ''),
      documentType: data.documentType || 'V'
    }

    return this.createTicket(ticketData, user.id)
  }

  async createTicket(data: any, customerId?: string) {
    if (data.amount === undefined || data.amount === null) {
      throw new BadRequestException('El monto total del pedido es requerido.')
    }
    const ticketExchangeRate = await this.resolveCurrentExchangeRate(data?.exchangeRate)
    return this.dataSource.transaction(async (manager) => {
      const repoTicket = manager.getRepository(Ticket)
      const repoUser = manager.getRepository(User)
      const repoCoupon = manager.getRepository(Coupon)
      const now = new Date()

      let user: User | null = null
      if (customerId) {
        user = await repoUser.findOne({ where: { id: customerId } })
      }

      const rawCouponId = typeof data?.couponId === 'string'
        ? data.couponId
        : typeof data?.couponCode === 'string' && isUUID(data.couponCode)
          ? data.couponCode
          : null

      let coupon: Coupon | null = null
      if (rawCouponId) {
        if (!customerId) {
          throw new BadRequestException('Debes iniciar sesion para usar cupones')
        }
        coupon = await repoCoupon.findOne({ where: { id: rawCouponId }, relations: ['user'] })
        if (!coupon) throw new NotFoundException('Cupon no encontrado')
        if (!coupon.user || coupon.user.id !== customerId) {
          throw new ForbiddenException('No puedes usar este cupon')
        }
        if (coupon.status === 'used') {
          throw new BadRequestException('El cupon ya fue usado')
        }
        if (coupon.status !== 'available') {
          throw new BadRequestException('El cupon no esta disponible')
        }
        if (coupon.expiresAt && coupon.expiresAt < now) {
          await repoCoupon.update({ id: rawCouponId }, { status: 'expired' })
          throw new BadRequestException('El cupon esta expirado')
        }

        await repoCoupon.update(
          { id: rawCouponId },
          { status: 'used', usedAt: now, verifiedBy: null, expiresAt: null },
        )

        await this.logActivity(customerId, 'USE', {
          couponId: coupon.id,
          couponTitle: coupon.title,
          source: 'ticket',
        }, manager, now)
      }

      const { couponId, ...ticketPayload } = data ?? {}
      const hydratedItems = await this.hydrateTicketItemsWithCatalogPoints(ticketPayload.items ?? [], manager)
      const itemsPayload = this.applyCouponPointBlocking(hydratedItems, coupon)
      const points = itemsPayload.points
      const items = itemsPayload.items
      const exchangeRate = ticketExchangeRate.rate
      const exchangeRateDate = ticketExchangeRate.date

      const ticket = repoTicket.create({
        ...ticketPayload,
        amount: this.roundMoney(ticketPayload.amount),
        discount: this.roundMoney(ticketPayload.discount ?? 0),
        items,
        points,
        exchangeRate,
        exchangeRateDate,
        status: 'pending',
        createdAt: now,
        couponCode: typeof ticketPayload.couponCode === 'string'
          ? ticketPayload.couponCode
          : coupon?.title ?? null,
      }) as unknown as Ticket
      if (user) ticket.user = user

      const savedTicket = await repoTicket.save(ticket)
      // Fire and forget notification
      this.notifyNewOrder(savedTicket).catch(e => console.error('Error sending notification', e))
      return this.serializeTicket(savedTicket)
    })
  }

  async getTicketPointsIntegrity(limit?: number) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 1000)) : 200
    const tickets = await this.ticketRepo.find({
      where: { status: 'confirmed' },
      relations: ['user'],
      order: { confirmedAt: 'DESC', id: 'DESC' },
      take: safeLimit,
    })

    const ticketCodes = tickets
      .filter((ticket) => Boolean(ticket.user?.id))
      .map((ticket) => `ticket://${ticket.id.toString().padStart(6, '0')}`)

    const claims = ticketCodes.length
      ? await this.claimRepo.find({ where: { code: In(ticketCodes) } })
      : []
    const claimByCode = new Map(claims.map((claim) => [claim.code, claim]))

    const mismatches = tickets
      .filter((ticket) => Boolean(ticket.user?.id))
      .map((ticket) => {
        const claimCode = `ticket://${ticket.id.toString().padStart(6, '0')}`
        const claim = claimByCode.get(claimCode)
        const storedPoints = Number(ticket.points ?? 0)
        const computedPoints = this.computeTicketPointsFromItems(ticket.items)
        const safeStoredPoints = Number.isFinite(storedPoints) ? storedPoints : 0
        const expectedPoints = computedPoints > 0 ? computedPoints : safeStoredPoints
        const claimPoints = Number(claim?.points ?? 0)
        const safeClaimPoints = Number.isFinite(claimPoints) ? claimPoints : 0

        const missingClaim = expectedPoints > 0 && !claim
        const pointsMismatch = Boolean(claim) && Math.abs(safeClaimPoints - expectedPoints) > 0.0001
        const ticketPointsMismatch = Math.abs(safeStoredPoints - expectedPoints) > 0.0001
        if (!missingClaim && !pointsMismatch && !ticketPointsMismatch) return null

        return {
          ticketId: ticket.id,
          userId: ticket.user?.id ?? null,
          claimCode,
          expectedPoints,
          storedTicketPoints: safeStoredPoints,
          claimPoints: claim ? safeClaimPoints : null,
          reason: missingClaim
            ? 'missing_claim'
            : pointsMismatch
              ? 'points_mismatch'
              : 'ticket_points_mismatch',
          confirmedAt: ticket.confirmedAt ?? null,
          createdAt: ticket.createdAt,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    return {
      checkedTickets: tickets.length,
      checkedTicketsWithUser: ticketCodes.length,
      issueCount: mismatches.length,
      issues: mismatches,
    }
  }

  async reconcileTicketPoints(options: { limit?: number; dryRun?: boolean } = {}) {
    const dryRun = options.dryRun ?? true
    const safeLimit = Number.isFinite(options.limit)
      ? Math.max(1, Math.min(Number(options.limit), 1000))
      : 200

    const integrity = await this.getTicketPointsIntegrity(safeLimit)
    const issues = Array.isArray(integrity.issues) ? integrity.issues : []
    const touchedUsers = new Set<string>()
    const actions: Array<{
      ticketId: number
      userId: string | null
      action: 'create_claim' | 'increase_claim_points' | 'update_ticket_points' | 'skip' | 'manual_review'
      dryRun: boolean
      pointsApplied?: number
      pointsDelta?: number
      note?: string
    }> = []

    for (const issue of issues) {
      const ticketId = Number(issue.ticketId)
      if (!Number.isFinite(ticketId)) {
        actions.push({
          ticketId: Number(issue.ticketId ?? 0),
          userId: issue.userId ?? null,
          action: 'skip',
          dryRun,
          note: 'ticket_id_invalid',
        })
        continue
      }

      try {
        const actionResult = await this.dataSource.transaction(async (manager) => {
          const repoTicket = manager.getRepository(Ticket)
          const repoClaim = manager.getRepository(ProductClaim)

          const ticket = await repoTicket
            .createQueryBuilder('ticket')
            .leftJoinAndSelect('ticket.user', 'user')
            .setLock('pessimistic_write', undefined, ['ticket'])
            .where('ticket.id = :id', { id: ticketId })
            .getOne()

          if (!ticket || ticket.status !== 'confirmed') {
            return {
              ticketId,
              userId: ticket?.user?.id ?? null,
              action: 'skip' as const,
              dryRun,
              note: 'ticket_not_confirmed_or_missing',
            }
          }

          if (!ticket.user?.id) {
            return {
              ticketId,
              userId: null,
              action: 'skip' as const,
              dryRun,
              note: 'ticket_without_user',
            }
          }

          const claimCode = `ticket://${ticket.id.toString().padStart(6, '0')}`
          const existingClaim = await repoClaim.findOne({ where: { code: claimCode } })
          const computedPoints = this.computeTicketPointsFromItems(ticket.items)
          const storedPoints = Number(ticket.points ?? 0)
          const safeStoredPoints = Number.isFinite(storedPoints) ? storedPoints : 0
          const expectedPoints = computedPoints > 0 ? computedPoints : safeStoredPoints
          const ticketPointsDelta = expectedPoints - safeStoredPoints
          const ticketPointsOutOfSync = Math.abs(ticketPointsDelta) > 0.0001
          const confirmedAt = ticket.confirmedAt ?? new Date()

          if (expectedPoints <= 0) {
            return {
              ticketId,
              userId: ticket.user.id,
              action: 'skip' as const,
              dryRun,
              note: 'expected_points_is_zero',
            }
          }

          if (!existingClaim) {
            if (dryRun) {
              return {
                ticketId,
                userId: ticket.user.id,
                action: 'create_claim' as const,
                dryRun,
                pointsApplied: expectedPoints,
                note: ticketPointsOutOfSync
                  ? 'would_create_missing_claim_and_update_ticket_points'
                  : 'would_create_missing_claim',
              }
            }

            if (ticketPointsOutOfSync) {
              ticket.points = expectedPoints
              await repoTicket.save(ticket)
            }
            const claim = repoClaim.create({
              code: claimCode,
              status: 'claimed',
              points: expectedPoints,
              claimedBy: ticket.user,
              claimedAt: confirmedAt,
            })
            await repoClaim.save(claim)
            const rules = await this.getActiveRules(manager)
            await this.processSaleRewards(ticket.user.id, expectedPoints, manager, rules, confirmedAt)
            touchedUsers.add(ticket.user.id)
            return {
              ticketId,
              userId: ticket.user.id,
              action: 'create_claim' as const,
              dryRun,
              pointsApplied: expectedPoints,
            }
          }

          const claimPointsRaw = Number(existingClaim.points ?? 0)
          const claimPoints = Number.isFinite(claimPointsRaw) ? claimPointsRaw : 0
          const delta = expectedPoints - claimPoints

          if (Math.abs(delta) <= 0.0001) {
            if (ticketPointsOutOfSync) {
              if (dryRun) {
                return {
                  ticketId,
                  userId: ticket.user.id,
                  action: 'update_ticket_points' as const,
                  dryRun,
                  pointsDelta: ticketPointsDelta,
                  note: 'would_update_ticket_points',
                }
              }
              ticket.points = expectedPoints
              await repoTicket.save(ticket)
              return {
                ticketId,
                userId: ticket.user.id,
                action: 'update_ticket_points' as const,
                dryRun,
                pointsDelta: ticketPointsDelta,
                note: 'ticket_points_updated',
              }
            }
            return {
              ticketId,
              userId: ticket.user.id,
              action: 'skip' as const,
              dryRun,
              note: 'already_consistent',
            }
          }

          if (delta < 0) {
            return {
              ticketId,
              userId: ticket.user.id,
              action: 'manual_review' as const,
              dryRun,
              pointsDelta: delta,
              note: 'claim_points_higher_than_expected',
            }
          }

          if (dryRun) {
            return {
              ticketId,
              userId: ticket.user.id,
              action: 'increase_claim_points' as const,
              dryRun,
              pointsDelta: delta,
              note: 'would_increase_claim_points',
            }
          }

          existingClaim.points = expectedPoints
          await repoClaim.save(existingClaim)
          const rules = await this.getActiveRules(manager)
          await this.processSaleRewards(ticket.user.id, delta, manager, rules, confirmedAt)
          touchedUsers.add(ticket.user.id)
          return {
            ticketId,
            userId: ticket.user.id,
            action: 'increase_claim_points' as const,
            dryRun,
            pointsDelta: delta,
          }
        })

        actions.push(actionResult)
      } catch (err: any) {
        actions.push({
          ticketId,
          userId: issue.userId ?? null,
          action: 'manual_review',
          dryRun,
          note: err?.message || 'reconcile_failed',
        })
      }
    }

    if (!dryRun) {
      await this.clearDashboardStats()
      for (const userId of touchedUsers) {
        await this.invalidateUserState(userId)
      }
    }

    return {
      dryRun,
      checkedTickets: integrity.checkedTickets,
      issueCount: integrity.issueCount,
      actionableIssues: issues.length,
      actions,
    }
  }

  async cancelTicket(id: number, userId?: string) {
    try {
      const where: any = { id }
      if (userId) where.user = { id: userId }

      const ticket = await this.ticketRepo.findOne({ where, relations: ['user'] })
      if (!ticket) {
        throw new NotFoundException('Ticket no encontrado o no tienes permiso')
      }
      if (ticket.status !== 'pending') {
        throw new BadRequestException('Solo se pueden cancelar tickets pendientes')
      }

      await this.dataSource.transaction(async (manager) => {
        // If it's a client we just mark as cancelled, if it's admin/seller we delete?
        // User said: "permitle cancelar pedidos... si un pedido tiene 24h... b├│rralo".
        // Actually, "cancelar" usually doesn't mean delete.
        // But the existing code was deleting: `manager.remove(ticket)`.
        // I'll stick to deletion if that was the intended "cancellation" in this codebase.
        // Wait, line 1286 was `manager.remove(ticket)`.

        await manager.remove(ticket)
      })

      return { ok: true, message: 'Ticket cancelado' }
    } catch (e: any) {
      console.error('cancelTicket error', e)
      if (e instanceof HttpException) throw e
      throw new InternalServerErrorException('Error al cancelar ticket')
    }
  }

  private parseTicketCursor(cursor?: string | null) {
    if (!cursor) return null
    const [rawDate, rawId] = cursor.split('|')
    if (!rawDate || !rawId) return null
    const date = new Date(rawDate)
    if (Number.isNaN(date.getTime())) return null
    const id = Number(rawId)
    if (!Number.isFinite(id)) return null
    return { date, id }
  }

  private buildTicketCursor(ticket: Ticket) {
    return `${ticket.createdAt.toISOString()}|${ticket.id}`
  }

  async getAllTickets(userId?: string, params: { limit?: number; cursor?: string | null } = {}) {
    const limit = Number.isFinite(params.limit)
      ? Math.max(1, Math.min(Number(params.limit), 200))
      : 100
    const cursor = this.parseTicketCursor(params.cursor ?? null)

    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .orderBy('ticket.createdAt', 'DESC')
      .addOrderBy('ticket.id', 'DESC')
      .take(limit + 1)

    if (userId) {
      qb.where('ticket.user_id = :userId', { userId })
    }

    if (cursor) {
      qb.andWhere(
        '(ticket.createdAt < :cursorDate OR (ticket.createdAt = :cursorDate AND ticket.id < :cursorId))',
        { cursorDate: cursor.date, cursorId: cursor.id },
      )
    }

    const items = await qb.getMany()
    const hasMore = items.length > limit
    if (hasMore) items.pop()
    await this.enrichTicketsWithHistoricalExchangeRates(items)
    const last = items[items.length - 1]
    const nextCursor = hasMore && last ? this.buildTicketCursor(last) : null

    return { items: items.map((ticket) => this.serializeTicket(ticket)), nextCursor }
  }

  async confirmTicket(id: number) {
    let saved: Ticket
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const repoTicket = manager.getRepository(Ticket)
        const repoClaim = manager.getRepository(ProductClaim)
        const ticket = await repoTicket
          .createQueryBuilder('ticket')
          .leftJoinAndSelect('ticket.user', 'user')
          .setLock('pessimistic_write', undefined, ['ticket'])
          .where('ticket.id = :id', { id })
          .getOne()

        if (!ticket) throw new NotFoundException('Ticket no encontrado')

        const now = new Date()
        let needsSave = false
        if (ticket.status !== 'confirmed') {
          await this.decrementProductStock(Array.isArray(ticket.items) ? ticket.items : [], manager)
          ticket.status = 'confirmed'
          needsSave = true
        }
        if (!ticket.confirmedAt) {
          ticket.confirmedAt = now
          needsSave = true
        }
        const storedPoints = Number(ticket.points ?? 0)
        const computedPoints = this.computeTicketPointsFromItems(ticket.items)
        const safeStoredPoints = Number.isFinite(storedPoints) ? storedPoints : 0
        const points = computedPoints > 0 ? computedPoints : safeStoredPoints

        if (computedPoints > 0 && computedPoints !== safeStoredPoints) {
          ticket.points = computedPoints
          needsSave = true
        }

        const confirmedAt = ticket.confirmedAt ?? now
        if (ticket.user && points > 0) {
          const validId = ticket.id.toString().padStart(6, '0')
          const claimCode = `ticket://${validId}`
          const existingClaim = await repoClaim.findOne({ where: { code: claimCode } })

          if (!existingClaim) {
            const rules = await this.getActiveRules(manager)
            const claim = repoClaim.create({
              code: claimCode,
              status: 'claimed',
              points,
              claimedBy: ticket.user,
              claimedAt: confirmedAt,
            })
            await repoClaim.save(claim)
            await this.processSaleRewards(
              ticket.user.id,
              points,
              manager,
              rules,
              confirmedAt,
            )
            console.log(`[LoyaltyService] Ticket #${ticket.id} confirmed with ${points} points for user ${ticket.user.id}`)
          } else {
            console.log(`[LoyaltyService] Ticket #${ticket.id} already has claim ${claimCode}, skipping duplicate points`)
          }
        }

        return needsSave ? await repoTicket.save(ticket) : ticket
      })
    } catch (e: any) {
      console.error(`[LoyaltyService] confirmTicket error for ticket #${id}`, e)
      if (e instanceof HttpException) throw e
      throw new InternalServerErrorException('Error al confirmar ticket')
    }

    try {
      const rawItems = Array.isArray(saved.items) ? saved.items : []
      if (rawItems.length) {
        const paymentBasis = `${saved.bank ?? ''} ${saved.reference ?? ''}`.toLowerCase()
        let paymentMethod: string | null = null

        if (paymentBasis.includes('zelle')) paymentMethod = 'zelle'
        else if (paymentBasis.includes('punto') || paymentBasis.includes('tarjeta')) paymentMethod = 'punto'
        else if (paymentBasis.includes('pago') || paymentBasis.includes('movil') || paymentBasis.includes('bancamiga')) paymentMethod = 'pago_movil'
        else if (paymentBasis.includes('efectivo')) {
          paymentMethod = (saved.currency || '').toUpperCase() === 'USD' ? 'efectivo_usd' : 'efectivo_bs'
        } else if (paymentBasis.includes('transfer') || paymentBasis.includes('cuenta')) {
          paymentMethod = 'transferencia'
        }

        const totalPaid = Number(saved.amount ?? 0)
        const roundMoney = (value: number) => Math.round(value * 100) / 100
        const totalItemsValue = rawItems.reduce((sum, item) => {
          const qty = Number(item?.quantity ?? 1) || 1
          const price = Number(item?.price ?? 0)
          return sum + (price * qty)
        }, 0)

        let remaining = roundMoney(totalPaid)
        const items: SaleItemWithPayment[] = rawItems.map((item, idx) => {
          const qty = Math.max(1, Number(item?.quantity ?? 1) || 1)
          const price = Number(item?.price ?? 0)
          const baseValue = price * qty
          const share = totalItemsValue > 0
            ? (totalPaid * baseValue) / totalItemsValue
            : rawItems.length
              ? totalPaid / rawItems.length
              : 0
          const amount = idx === rawItems.length - 1 ? remaining : roundMoney(share)
          remaining = roundMoney(remaining - amount)

          return {
            code: `ticket-${saved.id}-${idx}`,
            name: item?.name || 'Venta',
            price,
            points: typeof item?.points === 'number' ? item.points : 0,
            productId: item?.productId,
            quantity: qty,
            paymentMethod,
            paymentDetails: paymentMethod ? [{ method: paymentMethod, amount, currency: saved.currency || 'USD' }] : null,
          }
        })

        await this.persistSaleEvents(items, {
          source: 'ticket',
          occurredAt: saved.confirmedAt ?? new Date(),
          customerEmail: saved.customerEmail ?? null,
          customerId: saved.user?.id ?? null,
          currency: saved.currency,
          exchangeRate: saved.exchangeRate ?? undefined,
          exchangeRateDate: saved.exchangeRateDate ?? null,
          paymentMethod: paymentMethod ?? undefined,
          total: totalPaid,
          discount: saved.discount ?? 0,
          couponId: saved.couponCode ?? null,
        })
      }
    } catch (err) {
      console.error('confirmTicket sales log error', err)
    }

    await this.clearDashboardStats()
    if (saved.user) await this.invalidateUserState(saved.user.id)

    return this.serializeTicket(saved)
  }

  private getGoogleMapsApiKey() {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
    if (!key) {
      throw new BadRequestException('GOOGLE_MAPS_API_KEY no esta configurada en el backend')
    }
    return key
  }

  async proxyPlaceAutocomplete(payload: any = {}) {
    const input = this.trimToLength(typeof payload?.input === 'string' ? payload.input : null, 180)
    if (!input || input.length < 3) {
      throw new BadRequestException('Debes enviar al menos 3 caracteres para buscar ubicaciones')
    }

    const body: Record<string, unknown> = {
      input,
      sessionToken: this.trimToLength(typeof payload?.sessionToken === 'string' ? payload.sessionToken : null, 120) ?? undefined,
    }
    if (payload?.locationBias && typeof payload.locationBias === 'object') {
      body.locationBias = payload.locationBias
    }

    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.getGoogleMapsApiKey(),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Places autocomplete proxy error:', errorText)
      throw new InternalServerErrorException(`Google API Error: ${response.status}`)
    }

    return response.json()
  }

  async proxyPlaceDetails(placeId: string) {
    const safePlaceId = this.trimToLength(placeId, 240)
    if (!safePlaceId) {
      throw new BadRequestException('Place ID missing')
    }

    const cacheKey = `place_details_${safePlaceId}`
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached as any

    try {
      // Use Google Places API (New)
      const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(safePlaceId)}`
      const response = await fetch(url, {
        headers: {
          'X-Goog-Api-Key': this.getGoogleMapsApiKey(),
          'X-Goog-FieldMask': 'location,displayName,formattedAddress,addressComponents,name',
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Proxy Error:', errorText)
        throw new InternalServerErrorException(`Google API Error: ${response.status}`)
      }

      const data = await response.json()
      await this.cacheManager.set(cacheKey, data, 86400000) // 24 hours
      return data
    } catch (e: any) {
      if (e instanceof HttpException) throw e
      console.error('Proxy Exception:', e)
      throw new InternalServerErrorException('Proxy failed')
    }
  }

  async proxyReverseGeocode(lat: unknown, lng: unknown) {
    const latitude = Number(lat)
    const longitude = Number(lng)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Coordenadas invalidas')
    }

    const cacheKey = `reverse_geocode_${latitude.toFixed(6)}_${longitude.toFixed(6)}`
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached as any

    const params = new URLSearchParams({
      latlng: `${latitude},${longitude}`,
      key: this.getGoogleMapsApiKey(),
    })
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Reverse geocode proxy error:', errorText)
      throw new InternalServerErrorException(`Google API Error: ${response.status}`)
    }

    const data = await response.json()
    await this.cacheManager.set(cacheKey, data, 86400000)
    return data
  }

  async getLocations(userId: string) {
    return this.locationRepo.find({
      where: { user: { id: userId } },
      order: { updatedAt: 'DESC' },
    })
  }

  async setDefaultLocation(userId: string, locationId: string) {
    const loc = await this.locationRepo.findOne({
      where: { id: locationId, user: { id: userId } },
    })
    if (!loc) throw new NotFoundException('Ubicacion no encontrada')
    // Touching the location updates updatedAt, moving it to top of list
    loc.updatedAt = new Date()
    return this.locationRepo.save(loc)
  }

  async addLocation(userId: string, data: any) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    const count = await this.locationRepo.count({ where: { user: { id: userId } } })
    // Limit to 5 locations
    if (count >= 5) {
      const oldest = await this.locationRepo.find({
        where: { user: { id: userId } },
        order: { updatedAt: 'ASC' },
        take: count - 4 // Remove enough to have 4 left so we can add 1 = 5
      })
      if (oldest.length > 0) {
        await this.locationRepo.remove(oldest)
      }
    }

    const loc = this.locationRepo.create({
      ...data,
      user,
    })
    return this.locationRepo.save(loc)
  }

  async removeLocation(userId: string, locationId: string) {
    const loc = await this.locationRepo.findOne({
      where: { id: locationId, user: { id: userId } },
    })
    if (!loc) throw new NotFoundException('Ubicacion no encontrada')
    return this.locationRepo.remove(loc)
  }

  private pickupTableReady = false

  private async ensurePickupLocationsTable() {
    if (this.pickupTableReady) return

    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS pickup_locations (
          id uuid PRIMARY KEY,
          description varchar(400) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT now(),
          updated_at TIMESTAMP NOT NULL DEFAULT now()
        )
      `)
      await this.dataSource.query(`ALTER TABLE pickup_locations ENABLE ROW LEVEL SECURITY`)
      this.pickupTableReady = true
    } catch (error: any) {
      console.error('[LoyaltyService] ensurePickupLocationsTable error', error)
      throw new InternalServerErrorException('No se pudo preparar almacenamiento para pick up')
    }
  }

  private normalizePickupDescription(value: any) {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return trimmed.length > 400 ? trimmed.slice(0, 400) : trimmed
  }

  async getPublicPickupLocations() {
    await this.ensurePickupLocationsTable()
    const cacheKey = 'pickup_locations_public'
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached as PickupLocation[]

    const rows = await this.pickupLocationRepo.find({
      order: { createdAt: 'ASC' },
    })
    await this.cacheManager.set(cacheKey, rows, 60000)
    return rows
  }

  async getAdminPickupLocations() {
    await this.ensurePickupLocationsTable()
    return this.pickupLocationRepo.find({
      order: { createdAt: 'ASC' },
    })
  }

  async addPickupLocation(data: any) {
    await this.ensurePickupLocationsTable()
    const description = this.normalizePickupDescription(data?.description)
    if (!description) {
      throw new BadRequestException('Descripcion de ubicacion requerida')
    }

    const created = this.pickupLocationRepo.create({ id: randomUUID(), description })
    const saved = await this.pickupLocationRepo.save(created)
    await this.cacheManager.del('pickup_locations_public')
    return saved
  }

  async removePickupLocation(id: string) {
    await this.ensurePickupLocationsTable()
    const existing = await this.pickupLocationRepo.findOne({ where: { id } })
    if (!existing) throw new NotFoundException('Ubicacion de pick up no encontrada')
    await this.pickupLocationRepo.remove(existing)
    await this.cacheManager.del('pickup_locations_public')
    return { ok: true }
  }

  async getRedisStats() {
    let client: Redis | null = null
    try {
      // Use a fresh connection to avoid cache-manager abstraction issues
      if (process.env.REDIS_URL) {
        client = new Redis(process.env.REDIS_URL)
      } else {
        client = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        })
      }

      const memoryInfo = await client.info('memory')
      const clientsInfo = await client.info('clients')

      // Parse the output string "used_memory_human:855.60K..."
      const match = memoryInfo.match(/used_memory_human:(.*)/)
      const usedMemory = match ? match[1].trim() : 'Unknown'
      const peakMatch = memoryInfo.match(/used_memory_peak_human:(.*)/)
      const peakMemory = peakMatch ? peakMatch[1].trim() : 'Unknown'

      const clientsMatch = clientsInfo.match(/connected_clients:(.*)/)
      const connectedClients = clientsMatch ? clientsMatch[1].trim() : 'Unknown'

      return {
        used_memory: usedMemory,
        peak_memory: peakMemory,
        connected_clients: connectedClients
      }
    } catch (e) {
      console.error('Redis Stats Error:', e)
      return { used_memory: 'Error', peak_memory: 'Error', connected_clients: 'Error' }
    } finally {
      if (client) client.disconnect()
    }
  }

  async getSupabaseStats() {
    try {
      // 1. Get DB Size from Postgres (Sum of all DBs)
      const sizeResult = await this.dataSource.query('SELECT sum(pg_database_size(datname)) as size_bytes FROM pg_database')
      const sizeBytes = sizeResult[0]?.size_bytes ? Number(sizeResult[0].size_bytes) : 0

      // We only track storage size now, egress is handled via Supabase Dashboard
      return {
        size_bytes: sizeBytes,
        egress_bytes: null
      }
    } catch (e) {
      console.error('Supabase Stats Error:', e)
      return { size_bytes: 0, egress_bytes: null }
    }
  }



  async getBusinessStatus(): Promise<BusinessStatus> {
    const cacheKey = 'business_status'
    const cached = await this.cacheManager.get(cacheKey)
    if (cached) return cached as BusinessStatus

    let status = await this.businessStatusRepo.findOne({ where: {} })
    if (!status) {
      status = this.businessStatusRepo.create({
        startHour: '13:00',
        endHour: '21:00',
        isForcedClosed: false,
      })
      await this.businessStatusRepo.save(status)
    }

    await this.cacheManager.set(cacheKey, status, 86400000) // 24 hours
    return status
  }

  async updateBusinessStatus(data: Partial<BusinessStatus>): Promise<BusinessStatus> {
    const status = await this.getBusinessStatus()
    this.businessStatusRepo.merge(status, data)
    const saved = await this.businessStatusRepo.save(status)
    await this.cacheManager.del('business_status')
    return saved
  }

  async registerExpense(dto: RegisterExpenseDto, userId: string) {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
    const safeOccurredAt = !Number.isNaN(occurredAt.getTime()) ? occurredAt : new Date()
    const resolvedExchangeRate = await this.resolveExchangeRateForDate(safeOccurredAt, dto.exchangeRate)
    const expense = this.expenseRepo.create({
      description: dto.description,
      amount: this.roundMoney(dto.amount),
      currency: dto.currency || 'USD',
      category: dto.category || 'other',
      source: 'manual',
      occurredAt: safeOccurredAt,
      recordedBy: { id: userId } as User,
      exchangeRate: resolvedExchangeRate.rate ?? undefined,
      exchangeRateDate: resolvedExchangeRate.date,
      paymentMethod: dto.paymentMethod ?? null,
    })
    const saved = await this.expenseRepo.save(expense)
    await this.clearDashboardStats()
    return saved
  }

  async getExpenses(params: { start?: string; end?: string; limit?: number } = {}) {
    const qb = this.expenseRepo
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.recordedBy', 'user')
      .orderBy('expense.occurredAt', 'DESC')

    if (params.start) {
      const startDate = new Date(params.start)
      if (!Number.isNaN(startDate.getTime())) {
        qb.andWhere('expense.occurredAt >= :start', { start: startDate })
      }
    }

    if (params.end) {
      const endDate = new Date(params.end)
      if (!Number.isNaN(endDate.getTime())) {
        qb.andWhere('expense.occurredAt <= :end', { end: endDate })
      }
    }

    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(Number(params.limit), 5000)) : 5000
    qb.take(limit)

    return qb.getMany()
  }

  private readRequiredClosureTotal(payload: CreateCashClosurePayload, field: keyof CreateCashClosurePayload) {
    const raw = payload?.[field]
    if (raw === undefined || raw === null || raw === '') {
      throw new BadRequestException(`Cierre de caja: falta ${String(field)}`)
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Cierre de caja: ${String(field)} no es numerico`)
    }
    return this.roundMoney(parsed)
  }

  private readRequiredClosureMoney(line: CashClosureLineInput, field: keyof CashClosureLineInput, method: string) {
    const raw = line?.[field]
    if (raw === undefined || raw === null || raw === '') {
      throw new BadRequestException(`Linea de cierre ${method}: falta ${String(field)}`)
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Linea de cierre ${method}: ${String(field)} no es numerico`)
    }
    return this.roundMoney(parsed)
  }

  private sanitizeCashClosureLine(line: CashClosureLineInput): CashClosureLine | null {
    const method = this.normalizePaymentMethod(String(line?.method ?? ''))
    if (!method) return null
    const nativeCurrency = String(line?.nativeCurrency ?? '').toUpperCase()
    if (nativeCurrency !== 'USD' && nativeCurrency !== 'VES') {
      throw new BadRequestException(`Linea de cierre ${method}: moneda nativa invalida`)
    }
    return {
      method,
      expectedUsd: this.readRequiredClosureMoney(line, 'expectedUsd', method),
      expectedVes: this.readRequiredClosureMoney(line, 'expectedVes', method),
      countedUsd: this.readRequiredClosureMoney(line, 'countedUsd', method),
      countedVes: this.readRequiredClosureMoney(line, 'countedVes', method),
      diffUsd: this.readRequiredClosureMoney(line, 'diffUsd', method),
      diffVes: this.readRequiredClosureMoney(line, 'diffVes', method),
      nativeCurrency,
      hasActivity: Boolean(line?.hasActivity),
      hasDifference: Boolean(line?.hasDifference),
    }
  }

  private sanitizeCashClosure(closure: CashClosure) {
    return {
      ...closure,
      closedBy: this.sanitizeUser(closure.closedBy),
    }
  }

  private isVesPaymentMethod(method: string) {
    return ['efectivo_bs', 'pago_movil', 'punto', 'transferencia', 'otro', 'sin_metodo_bs'].includes(method)
  }

  private isChangePaymentMethod(method: string) {
    return method.startsWith('vuelto_') || method.startsWith('change_')
  }

  private stripChangePaymentPrefix(method: string) {
    return method.replace(/^vuelto_/, '').replace(/^change_/, '')
  }

  private getCaracasDayBounds(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map((part) => Number(part))
    if (!year || !month || !day) return null
    const start = new Date(Date.UTC(year, month - 1, day, 4, 0, 0, 0))
    const end = new Date(Date.UTC(year, month - 1, day + 1, 3, 59, 59, 999))
    return { start, end }
  }

  private getSaleAmountUsdForClosure(sale: SaleEvent, fallbackRate: number | null) {
    const quantity = Math.max(1, Number(sale.quantity ?? 1) || 1)
    const amount = this.roundMoney(Number(sale.price ?? 0) * quantity)
    const currency = String(sale.currency || 'USD').toUpperCase()
    const rate = this.parseExchangeRate(sale.exchangeRate) ?? fallbackRate
    if (currency === 'VES') return rate ? this.roundMoney(amount / rate) : 0
    return amount
  }

  private getDetailAmountsForClosure(detail: any, saleRate: number | null, fallbackRate: number | null) {
    const rawMethod = this.normalizePaymentMethod(detail?.method ?? null)
    if (!rawMethod) return null
    const isChange = this.isChangePaymentMethod(rawMethod)
    const method = isChange ? this.stripChangePaymentPrefix(rawMethod) : rawMethod
    const amountNative = this.roundMoney(Number(detail?.amountNative ?? detail?.amount ?? 0))
    if (!method || amountNative <= 0) return null
    const currencyNative = this.inferPaymentCurrency(method, detail?.currencyNative ?? detail?.currency) as 'USD' | 'VES'
    const rate = this.parseExchangeRate(detail?.exchangeRate) ?? saleRate ?? fallbackRate
    const explicitUsd = this.roundMoney(Number(detail?.amountUsd ?? 0))
    const amountUsd = explicitUsd > 0
      ? explicitUsd
      : currencyNative === 'VES'
        ? (rate ? this.roundMoney(amountNative / rate) : 0)
        : amountNative
    const amountVes = this.isVesPaymentMethod(method)
      ? currencyNative === 'VES'
        ? amountNative
        : rate ? this.roundMoney(amountUsd * rate) : 0
      : 0
    return { method, amountUsd, amountVes, sign: isChange ? -1 : 1 }
  }

  private addExpectedToMethod(
    map: Map<string, { method: string; expectedUsd: number; expectedVes: number }>,
    method: string,
    amountUsd: number,
    amountVes: number,
  ) {
    const normalized = this.normalizePaymentMethod(method)
    if (!normalized) return
    const existing = map.get(normalized) ?? { method: normalized, expectedUsd: 0, expectedVes: 0 }
    existing.expectedUsd += amountUsd
    if (this.isVesPaymentMethod(normalized)) {
      existing.expectedVes += amountVes
    }
    map.set(normalized, existing)
  }

  private async buildCashClosureLinesFromSource(
    businessDate: string,
    fallbackRate: number | null,
    submittedLines: CashClosureLine[],
  ) {
    const bounds = this.getCaracasDayBounds(businessDate)
    if (!bounds) throw new BadRequestException('Fecha de cierre invalida')

    const [sales, expenses] = await Promise.all([
      this.saleRepo.find({ where: { occurredAt: Between(bounds.start, bounds.end) } }),
      this.expenseRepo.find({ where: { occurredAt: Between(bounds.start, bounds.end) } }),
    ])

    const expectedByMethod = new Map<string, { method: string; expectedUsd: number; expectedVes: number }>()
    const countedByMethod = new Map(submittedLines.map((line) => [line.method, line]))
    ;['efectivo_usd', 'efectivo_bs', 'pago_movil', 'punto', 'zelle', 'transferencia'].forEach((method) => {
      expectedByMethod.set(method, { method, expectedUsd: 0, expectedVes: 0 })
    })

    sales.forEach((sale) => {
      const saleRate = this.parseExchangeRate(sale.exchangeRate) ?? fallbackRate
      const details = Array.isArray(sale.paymentDetails) ? sale.paymentDetails : []
      if (details.length) {
        let incomeUsd = 0
        const movements = details
          .map((detail) => this.getDetailAmountsForClosure(detail, saleRate, fallbackRate))
          .filter((entry): entry is { method: string; amountUsd: number; amountVes: number; sign: number } => Boolean(entry))

        movements.forEach((entry) => {
          if (entry.sign > 0) incomeUsd += entry.amountUsd
        })

        const saleTotalUsd = this.getSaleAmountUsdForClosure(sale, fallbackRate)
        const scale = saleTotalUsd > 0 && incomeUsd > 0 && incomeUsd / saleTotalUsd > 1.05
          ? saleTotalUsd / incomeUsd
          : 1

        movements.forEach((entry) => {
          const amountUsd = entry.sign > 0 ? this.roundMoney(entry.amountUsd * scale) : entry.amountUsd
          const amountVes = entry.sign > 0 ? this.roundMoney(entry.amountVes * scale) : entry.amountVes
          this.addExpectedToMethod(expectedByMethod, entry.method, entry.sign * amountUsd, entry.sign * amountVes)
        })
        return
      }

      const saleTotalUsd = this.getSaleAmountUsdForClosure(sale, fallbackRate)
      const method = this.normalizePaymentMethod(sale.paymentMethod ?? null)
        ?? (String(sale.currency || 'USD').toUpperCase() === 'VES' ? 'sin_metodo_bs' : 'sin_metodo_usd')
      const amountVes = this.isVesPaymentMethod(method) && saleRate ? this.roundMoney(saleTotalUsd * saleRate) : 0
      this.addExpectedToMethod(expectedByMethod, method, saleTotalUsd, amountVes)
    })

    expenses.forEach((expense) => {
      const method = this.normalizePaymentMethod(expense.paymentMethod ?? null)
      if (!method) return
      const amount = this.roundMoney(Number(expense.amount ?? 0))
      if (amount <= 0) return
      const currency = String(expense.currency || 'USD').toUpperCase()
      const rate = this.parseExchangeRate(expense.exchangeRate) ?? fallbackRate
      const amountUsd = currency === 'VES' ? (rate ? this.roundMoney(amount / rate) : 0) : amount
      const amountVes = currency === 'VES' ? amount : 0
      this.addExpectedToMethod(expectedByMethod, method, -amountUsd, -amountVes)
    })

    submittedLines.forEach((line) => {
      if (!expectedByMethod.has(line.method)) {
        expectedByMethod.set(line.method, { method: line.method, expectedUsd: 0, expectedVes: 0 })
      }
    })

    const order = new Map(['efectivo_usd', 'efectivo_bs', 'pago_movil', 'punto', 'zelle', 'transferencia'].map((method, index) => [method, index]))
    const lines = Array.from(expectedByMethod.values())
      .map((entry) => {
        const submitted = countedByMethod.get(entry.method)
        const nativeCurrency = this.isVesPaymentMethod(entry.method) ? 'VES' as const : 'USD' as const
        const expectedUsd = this.roundMoney(entry.expectedUsd)
        const expectedVes = this.roundMoney(entry.expectedVes)
        const countedUsd = this.roundMoney(submitted?.countedUsd ?? 0)
        const countedVes = this.roundMoney(submitted?.countedVes ?? 0)
        const diffUsd = this.roundMoney(countedUsd - expectedUsd)
        const diffVes = this.roundMoney(countedVes - expectedVes)
        const hasActivity = Math.abs(expectedUsd) > 0.009 || Math.abs(expectedVes) > 0.009 || Math.abs(countedUsd) > 0.009 || Math.abs(countedVes) > 0.009
        const hasDifference = Math.abs(nativeCurrency === 'VES' ? diffVes : diffUsd) > 0.009
        return { method: entry.method, expectedUsd, expectedVes, countedUsd, countedVes, diffUsd, diffVes, nativeCurrency, hasActivity, hasDifference }
      })
      .filter((line) => line.hasActivity || countedByMethod.has(line.method))
      .sort((a, b) => {
        const aIndex = order.get(a.method) ?? Number.MAX_SAFE_INTEGER
        const bIndex = order.get(b.method) ?? Number.MAX_SAFE_INTEGER
        if (aIndex !== bIndex) return aIndex - bIndex
        return a.method.localeCompare(b.method)
      })

    const totals = lines.reduce(
      (acc, line) => {
        if (line.nativeCurrency === 'VES') {
          acc.expectedVes += line.expectedVes
          acc.countedVes += line.countedVes
          acc.diffVes += line.diffVes
        } else {
          acc.expectedUsd += line.expectedUsd
          acc.countedUsd += line.countedUsd
          acc.diffUsd += line.diffUsd
        }
        if (line.hasDifference) acc.differenceCount += 1
        return acc
      },
      { expectedUsd: 0, expectedVes: 0, countedUsd: 0, countedVes: 0, diffUsd: 0, diffVes: 0, differenceCount: 0 },
    )

    return {
      lines,
      totals: {
        expectedUsd: this.roundMoney(totals.expectedUsd),
        expectedVes: this.roundMoney(totals.expectedVes),
        countedUsd: this.roundMoney(totals.countedUsd),
        countedVes: this.roundMoney(totals.countedVes),
        diffUsd: this.roundMoney(totals.diffUsd),
        diffVes: this.roundMoney(totals.diffVes),
        differenceCount: totals.differenceCount,
      },
    }
  }

  async getCashClosures(limit?: number) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 100)) : 25
    const records = await this.cashClosureRepo
      .createQueryBuilder('closure')
      .leftJoinAndSelect('closure.closedBy', 'user')
      .orderBy('closure.createdAt', 'DESC')
      .take(safeLimit)
      .getMany()

    return records.map((record) => this.sanitizeCashClosure(record))
  }

  async createCashClosure(payload: CreateCashClosurePayload = {}, userId: string) {
    const businessDate = payload.businessDate
      ? this.parseDateKey(payload.businessDate)
      : this.getCaracasDateKey()
    if (!businessDate) {
      throw new BadRequestException('Fecha de cierre inválida')
    }

    const submittedLines = Array.isArray(payload.lines)
      ? payload.lines
        .slice(0, 30)
        .map((line) => this.sanitizeCashClosureLine(line))
        .filter((line): line is CashClosureLine => Boolean(line))
      : []

    if (!submittedLines.length) {
      throw new BadRequestException('Debes enviar lineas de cierre por metodo')
    }

    ;['expectedUsd', 'expectedVes', 'countedUsd', 'countedVes', 'diffUsd', 'diffVes'].forEach((field) => {
      this.readRequiredClosureTotal(payload, field as keyof CreateCashClosurePayload)
    })

    const exchangeRate = this.parseExchangeRate(payload.exchangeRate)
    const reconciliation = await this.buildCashClosureLinesFromSource(businessDate, exchangeRate, submittedLines)

    const closure = this.cashClosureRepo.create({
      businessDate,
      exchangeRate,
      expectedUsd: reconciliation.totals.expectedUsd,
      expectedVes: reconciliation.totals.expectedVes,
      countedUsd: reconciliation.totals.countedUsd,
      countedVes: reconciliation.totals.countedVes,
      diffUsd: reconciliation.totals.diffUsd,
      diffVes: reconciliation.totals.diffVes,
      differenceCount: reconciliation.totals.differenceCount,
      lines: reconciliation.lines.length ? reconciliation.lines : null,
      note: this.trimToLength(typeof payload.note === 'string' ? payload.note : null, 1000),
      closedBy: { id: userId } as User,
    })

    const saved = await this.cashClosureRepo.save(closure)
    return this.sanitizeCashClosure(saved)
  }

  async auditFinancialExchangeRates(limit?: number) {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 1000)) : 500
    const [salesMissingRate, salesMissingDate, ticketsMissingRate, ticketsMissingDate, expensesMissingRate, expensesMissingDate] = await Promise.all([
      this.saleRepo.count({ where: { exchangeRate: IsNull() } }),
      this.saleRepo.count({ where: { exchangeRateDate: IsNull() } }),
      this.ticketRepo.count({ where: { exchangeRate: IsNull() } }),
      this.ticketRepo.count({ where: { exchangeRateDate: IsNull() } }),
      this.expenseRepo.count({ where: { exchangeRate: IsNull() } }),
      this.expenseRepo.count({ where: { exchangeRateDate: IsNull() } }),
    ])

    const [sampleSales, sampleTickets, sampleExpenses] = await Promise.all([
      this.saleRepo.find({
        where: [{ exchangeRate: IsNull() }, { exchangeRateDate: IsNull() }],
        order: { occurredAt: 'DESC' },
        take: safeLimit,
      }),
      this.ticketRepo.find({
        where: [{ exchangeRate: IsNull() }, { exchangeRateDate: IsNull() }],
        order: { createdAt: 'DESC' },
        take: safeLimit,
      }),
      this.expenseRepo.find({
        where: [{ exchangeRate: IsNull() }, { exchangeRateDate: IsNull() }],
        order: { occurredAt: 'DESC' },
        take: safeLimit,
      }),
    ])

    return {
      limit: safeLimit,
      missing: {
        sales: { rate: salesMissingRate, date: salesMissingDate },
        tickets: { rate: ticketsMissingRate, date: ticketsMissingDate },
        expenses: { rate: expensesMissingRate, date: expensesMissingDate },
      },
      samples: {
        sales: sampleSales.map((item) => ({ id: item.id, occurredAt: item.occurredAt, exchangeRate: item.exchangeRate ?? null, exchangeRateDate: item.exchangeRateDate ?? null })),
        tickets: sampleTickets.map((item) => ({ id: item.id, createdAt: item.createdAt, exchangeRate: item.exchangeRate ?? null, exchangeRateDate: item.exchangeRateDate ?? null })),
        expenses: sampleExpenses.map((item) => ({ id: item.id, occurredAt: item.occurredAt, exchangeRate: item.exchangeRate ?? null, exchangeRateDate: item.exchangeRateDate ?? null })),
      },
    }
  }

  async reconcileFinancialExchangeRates(payload: { limit?: number; dryRun?: boolean } = {}) {
    const safeLimit = Number.isFinite(payload.limit) ? Math.max(1, Math.min(Number(payload.limit), 1000)) : 500
    const dryRun = payload.dryRun !== false
    const actions: Array<{ table: string; id: string | number; dryRun: boolean; exchangeRate: number | null; exchangeRateDate: string | null; status: string }> = []

    const [sales, tickets, expenses] = await Promise.all([
      this.saleRepo.find({
        where: [{ exchangeRate: IsNull() }, { exchangeRateDate: IsNull() }],
        order: { occurredAt: 'DESC' },
        take: safeLimit,
      }),
      this.ticketRepo.find({
        where: [{ exchangeRate: IsNull() }, { exchangeRateDate: IsNull() }],
        order: { createdAt: 'DESC' },
        take: safeLimit,
      }),
      this.expenseRepo.find({
        where: [{ exchangeRate: IsNull() }, { exchangeRateDate: IsNull() }],
        order: { occurredAt: 'DESC' },
        take: safeLimit,
      }),
    ])

    for (const sale of sales) {
      const resolved = await this.resolveExchangeRateForDate(sale.occurredAt, sale.exchangeRate)
      actions.push({ table: 'sale_events', id: sale.id, dryRun, exchangeRate: resolved.rate, exchangeRateDate: resolved.date, status: resolved.rate ? 'resolved' : 'unresolved' })
      if (!dryRun && resolved.rate && resolved.date) {
        sale.exchangeRate = resolved.rate
        sale.exchangeRateDate = resolved.date
        await this.saleRepo.save(sale)
      }
    }

    for (const ticket of tickets) {
      const targetDate = ticket.confirmedAt ?? ticket.createdAt
      const resolved = await this.resolveExchangeRateForDate(targetDate, ticket.exchangeRate)
      actions.push({ table: 'tickets', id: ticket.id, dryRun, exchangeRate: resolved.rate, exchangeRateDate: resolved.date, status: resolved.rate ? 'resolved' : 'unresolved' })
      if (!dryRun && resolved.rate && resolved.date) {
        ticket.exchangeRate = resolved.rate
        ticket.exchangeRateDate = resolved.date
        await this.ticketRepo.save(ticket)
      }
    }

    for (const expense of expenses) {
      const resolved = await this.resolveExchangeRateForDate(expense.occurredAt, expense.exchangeRate)
      actions.push({ table: 'expenses', id: expense.id, dryRun, exchangeRate: resolved.rate, exchangeRateDate: resolved.date, status: resolved.rate ? 'resolved' : 'unresolved' })
      if (!dryRun && resolved.rate && resolved.date) {
        expense.exchangeRate = resolved.rate
        expense.exchangeRateDate = resolved.date
        await this.expenseRepo.save(expense)
      }
    }

    if (!dryRun) {
      await this.clearDashboardStats()
      await this.cacheManager.del('sales_events_recent')
    }

    return {
      dryRun,
      checked: sales.length + tickets.length + expenses.length,
      resolved: actions.filter((action) => action.status === 'resolved').length,
      unresolved: actions.filter((action) => action.status !== 'resolved').length,
      actions,
    }
  }

  async resetData(dto: ResetDataDto = {}) {
    const mode = dto?.mode === 'range' ? 'range' : 'all'
    try {
      if (mode === 'all') {
        // 1. Clear Sale Events (admin reports)
        await this.saleRepo.clear()

        // 2. Clear Expenses (admin reports)
        await this.expenseRepo.clear()

        // Tickets are intentionally preserved to avoid deleting client order history.
        await this.clearDashboardStats()
        await this.cacheManager.del('sales_events_recent')

        return {
          ok: true,
          mode: 'all' as const,
          message: 'Reportes de finanzas reiniciados correctamente',
        }
      }

      const startDate = dto.start ? new Date(dto.start) : null
      const endDate = dto.end ? new Date(dto.end) : null
      if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new BadRequestException('Debes indicar un rango valido para reiniciar por periodo')
      }
      if (endDate.getTime() < startDate.getTime()) {
        throw new BadRequestException('La fecha final no puede ser menor a la fecha inicial')
      }

      const [salesDeleteResult, expenseDeleteResult] = await Promise.all([
        this.saleRepo.delete({ occurredAt: Between(startDate, endDate) }),
        this.expenseRepo.delete({ occurredAt: Between(startDate, endDate) }),
      ])

      await this.clearDashboardStats()
      await this.cacheManager.del('sales_events_recent')

      return {
        ok: true,
        mode: 'range' as const,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        deletedSales: Number(salesDeleteResult.affected ?? 0),
        deletedExpenses: Number(expenseDeleteResult.affected ?? 0),
        message: 'Reportes de finanzas del periodo reiniciados correctamente',
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e
      console.error('resetData error', e)
      throw new InternalServerErrorException('Error al reiniciar reportes de finanzas')
    }
  }

  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY ?? null }
  }

  async saveSubscription(userId: string, subscription: any) {
    const user = await this.userRepo.findOne({ where: { id: userId } })
    if (!user) throw new NotFoundException('Usuario no encontrado')

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      throw new BadRequestException('Suscripcion push invalida')
    }

    // Only admins and sellers can receive notifications
    if (user.role !== 'admin' && user.role !== 'seller') {
      console.log(`[LoyaltyService] Skipping subscription for user ${userId} because role is ${user.role}`)
      throw new ForbiddenException('Solo administradores y vendedores pueden recibir notificaciones')
    }

    const existing = await this.pushRepo.findOne({ where: { endpoint: subscription.endpoint } })
    if (existing) {
      existing.user = user
      existing.keys = subscription.keys
      existing.expirationTime = typeof subscription.expirationTime === 'number'
        ? subscription.expirationTime
        : null
      return this.pushRepo.save(existing)
    }

    const sub = this.pushRepo.create({
      user,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      expirationTime: typeof subscription.expirationTime === 'number'
        ? subscription.expirationTime
        : null,
    })
    return this.pushRepo.save(sub)
  }

  async notifyNewOrder(ticket: Ticket) {
    console.log(`[LoyaltyService] notifyNewOrder triggered for ticket #${ticket.id}`)
    try {
      // Find all subscriptions mapping to users with admin or seller roles
      const subscriptions = await this.pushRepo.find({
        where: [
          { user: { role: 'admin' } },
          { user: { role: 'seller' } }
        ],
        relations: ['user']
      })

      console.log(`[LoyaltyService] Found ${subscriptions.length} push subscriptions for admins/sellers`)

      if (!subscriptions.length) return

      const payload = JSON.stringify({
        title: 'Nuevo Pedido Recibido',
        body: `Pedido #${ticket.id} por $${Number(ticket.amount).toFixed(2)} (${ticket.currency})`,
        url: '/admin/tickets'
      })

      const parallel = subscriptions.map(async (sub) => {
        try {
          console.log(`[LoyaltyService] Sending push to ${sub.endpoint.slice(0, 20)}...`)
          await webpush.sendNotification({
            endpoint: sub.endpoint,
            keys: sub.keys
          }, payload)
          console.log(`[LoyaltyService] Push sent successfully to ${sub.id}`)
        } catch (error: any) {
          console.error(`[LoyaltyService] Error sending push to ${sub.id}`, error)
          const hasVapidMismatch =
            error.statusCode === 403 &&
            typeof error.body === 'string' &&
            error.body.toLowerCase().includes('vapid credentials')

          if (error.statusCode === 410 || error.statusCode === 404 || hasVapidMismatch) {
            // Subscription gone
            await this.pushRepo.delete(sub.id)
            if (hasVapidMismatch) {
              console.log(`[LoyaltyService] Deleted stale subscription ${sub.id} due to VAPID mismatch`)
            }
          }
        }
      })

      await Promise.all(parallel)
    } catch (e) {
      console.error('[LoyaltyService] Error in notifyNewOrder', e)
    }
  }
}
