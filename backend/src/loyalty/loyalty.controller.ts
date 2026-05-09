import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { LoyaltyService } from './loyalty.service'
import { JwtAuthGuard } from '../auth/jwt.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import { ClaimDto } from './dto/claim.dto'
import { GenerateClaimsDto } from './dto/generate-claims.dto'
import { ClearClaimsDto } from './dto/clear-claims.dto'
import { RedeemCouponDto } from './dto/redeem-coupon.dto'
import { InspectCouponDto } from './dto/inspect-coupon.dto'
import { LookupUserDto } from './dto/lookup-user.dto'
import { TransferCouponDto } from './dto/transfer-coupon.dto'
import { RegisterSaleDto } from './dto/register-sale.dto'
import { LogSaleEventsDto } from './dto/log-sale-events.dto'
import { RegisterExpenseDto } from './dto/register-expense.dto'
import { UpdateLoyaltyRulesDto } from './dto/update-loyalty-rules.dto'
import { ResetDataDto } from './dto/reset-data.dto'

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) { }

  @Get('rules')
  getRules() {
    return this.loyaltyService.getRules()
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/rules')
  updateRules(@Body() dto: UpdateLoyaltyRulesDto, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede actualizar premios')
    }
    return this.loyaltyService.updateRules(dto)
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Post('claim')
  claimProduct(@Body() dto: ClaimDto, @CurrentUser() user: any) {
    return this.loyaltyService.claimProduct(dto.code, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.loyaltyService.getUserState(user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/profile')
  updateProfile(@Body() body: { phone?: string; cedula?: string; name?: string; hasSeenWelcome?: boolean; hasSeenFirstCoupon?: boolean; lastGiftSeenAt?: string | null }, @CurrentUser() user: any) {
    return this.loyaltyService.updateProfile(user.sub, body)
  }

  @UseGuards(JwtAuthGuard)
  @Post('notifications/subscribe')
  saveSubscription(@Body() body: any, @CurrentUser() user: any) {
    console.log('Received subscription request for user:', user.sub, body)
    return this.loyaltyService.saveSubscription(user.sub, body)
  }

  @Get('public/notifications/vapid-public-key')
  getVapidPublicKey() {
    return this.loyaltyService.getVapidPublicKey()
  }




  @UseGuards(JwtAuthGuard)
  @Post('claims/generate')
  generateClaims(@Body() dto: GenerateClaimsDto, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede generar códigos')
    }
    return this.loyaltyService.generateClaims(
      dto.count,
      dto.persist ?? false,
      dto.prefix,
      dto.points,
      {
        productId: dto.productId,
        productName: dto.productName,
        price: dto.price,
      },
    )
  }

  @UseGuards(JwtAuthGuard)
  @Post('claims/clear')
  clearClaims(@Body() dto: ClearClaimsDto, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede borrar códigos')
    }
    return this.loyaltyService.clearClaims(dto.codes)
  }

  @UseGuards(JwtAuthGuard)
  @Post('claims/verify')
  verifyClaims(@Body() dto: { codes: string[] }, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede verificar')
    }
    return this.loyaltyService.verifyClaims(dto.codes)
  }

  @UseGuards(JwtAuthGuard)
  @Post('coupons/redeem')
  redeemCoupon(@Body() dto: RedeemCouponDto, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede canjear')
    }
    return this.loyaltyService.redeemCoupon(dto.couponId, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('coupons/transfer')
  transferCoupon(@Body() dto: TransferCouponDto, @CurrentUser() user: any) {
    return this.loyaltyService.transferCoupon(dto.couponId, dto.recipientEmail, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('sales/register')
  registerSale(@Body() dto: RegisterSaleDto, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede registrar ventas')
    }
    return this.loyaltyService.registerSale(dto, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('sales/log')
  logSales(@Body() dto: LogSaleEventsDto, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede registrar ventas')
    }
    const parsedDate = dto.occurredAt ? new Date(dto.occurredAt) : undefined
    const safeDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined
    return this.loyaltyService.persistSaleEvents(
      dto.items,
      {
        source: dto.source || 'manual',
        occurredAt: safeDate,
        customerEmail: dto.customerEmail ?? null,
        customerName: dto.customerName ?? null,
        customerPhone: dto.customerPhone ?? null,
        documentType: dto.documentType ?? null,
        documentNumber: (dto as any).documentNumber ?? null,
        customerId: dto.customerId ?? null,
        actorId: user.sub,
        exchangeRate: dto.exchangeRate,
        paymentMethod: dto.paymentMethod,
        paymentDetails: dto.paymentDetails,
        total: dto.total,
        discount: dto.discount,
        couponId: dto.couponId ?? null,
      },
    )
  }

  @UseGuards(JwtAuthGuard)
  @Get('sales')
  getSales(
    @CurrentUser() user: any,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar')
    }
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    return this.loyaltyService.getSalesEvents({
      start,
      end,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    })
  }

  @UseGuards(JwtAuthGuard)
  @Post('expenses')
  registerExpense(@Body() dto: RegisterExpenseDto, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede registrar gastos')
    }
    return this.loyaltyService.registerExpense(dto, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Get('expenses')
  getExpenses(
    @CurrentUser() user: any,
    @Query('start') start?: string,
    @Query('end') end?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar gastos')
    }
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    return this.loyaltyService.getExpenses({
      start,
      end,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    })
  }

  @UseGuards(JwtAuthGuard)
  @Post('coupons/inspect')
  inspectCoupon(@Body() dto: InspectCouponDto, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar')
    }
    return this.loyaltyService.inspectCoupon(dto.couponId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/lookup')
  lookupUser(@Body() dto: LookupUserDto, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar')
    }
    return this.loyaltyService.lookupUser(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/count')
  getActiveUsers(@CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar')
    }
    return this.loyaltyService.countActiveUsers()
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede borrar usuarios')
    }
    return this.loyaltyService.deleteUser(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/reset-data')
  resetData(@CurrentUser() user: any, @Body() dto: ResetDataDto) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede reiniciar datos')
    }
    return this.loyaltyService.resetData(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/finance/audit')
  auditFinance(@CurrentUser() user: any, @Query('limit') limit?: string) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede auditar finanzas')
    }
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    return this.loyaltyService.auditFinancialExchangeRates(Number.isFinite(parsedLimit) ? parsedLimit : undefined)
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/cash-closures')
  getCashClosures(@CurrentUser() user: any, @Query('limit') limit?: string) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede consultar cierres de caja')
    }
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    return this.loyaltyService.getCashClosures(Number.isFinite(parsedLimit) ? parsedLimit : undefined)
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/cash-closures')
  createCashClosure(@CurrentUser() user: any, @Body() body: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede guardar cierres de caja')
    }
    return this.loyaltyService.createCashClosure(body, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/finance/reconcile')
  reconcileFinance(
    @CurrentUser() user: any,
    @Body() body: { limit?: number | string; dryRun?: boolean | string | number },
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede reconciliar finanzas')
    }
    const rawLimit = typeof body?.limit === 'string' ? parseInt(body.limit, 10) : body?.limit
    const rawDryRun = body?.dryRun
    const safeDryRun = rawDryRun === undefined
      ? true
      : (rawDryRun === true || rawDryRun === 'true' || rawDryRun === 1 || rawDryRun === '1')
    return this.loyaltyService.reconcileFinancialExchangeRates({
      limit: Number.isFinite(rawLimit) ? Number(rawLimit) : undefined,
      dryRun: safeDryRun,
    })
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/redis-stats')
  getRedisStats(@CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede ver estadísticas de Redis')
    }
    return this.loyaltyService.getRedisStats()
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/supabase-stats')
  getSupabaseStats(@CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede ver estadísticas de Supabase')
    }
    return this.loyaltyService.getSupabaseStats()
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/dashboard-stats')
  getDashboardStats(@CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede ver estadísticas')
    }
    return this.loyaltyService.getAdminDashboardStats()
  }

  @UseGuards(JwtAuthGuard)
  @Get('coupons/stats')
  getCouponStats(@CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar')
    }
    return this.loyaltyService.getCouponStats()
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/tickets/integrity')
  getTicketIntegrity(@CurrentUser() user: any, @Query('limit') limit?: string) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin o vendedor puede consultar')
    }
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : undefined
    return this.loyaltyService.getTicketPointsIntegrity(safeLimit)
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/tickets/reconcile')
  reconcileTicketIntegrity(
    @CurrentUser() user: any,
    @Body() body: { limit?: number | string; dryRun?: boolean | string | number },
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede ejecutar reconciliación')
    }
    const rawLimit = typeof body?.limit === 'string' ? parseInt(body.limit, 10) : body?.limit
    const safeLimit = Number.isFinite(rawLimit) ? Number(rawLimit) : undefined
    const rawDryRun = body?.dryRun
    const safeDryRun = rawDryRun === undefined
      ? true
      : (rawDryRun === true || rawDryRun === 'true' || rawDryRun === 1 || rawDryRun === '1')
    return this.loyaltyService.reconcileTicketPoints({
      limit: safeLimit,
      dryRun: safeDryRun,
    })
  }

  // --- TICKETS ---

  @Post('public/tickets')
  createGuestTicket(@Body() dto: any) {
    return this.loyaltyService.createGuestTicket(dto)
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets')
  createTicket(@Body() dto: any, @CurrentUser() user: any) {
    return this.loyaltyService.createTicket(dto, user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Get('tickets')
  getAllTickets(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : undefined
    const ticketParams = {
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      cursor,
    }
    if (user.role === 'client') {
      return this.loyaltyService.getAllTickets(user.sub, ticketParams)
    }
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('No tienes permisos')
    }
    return this.loyaltyService.getAllTickets(undefined, ticketParams)
  }

  @UseGuards(JwtAuthGuard)
  @Post('tickets/:id/confirm')
  confirmTicket(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('Solo admin confirma tickets')
    }
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) {
      throw new ForbiddenException('ID de ticket inválido')
    }
    return this.loyaltyService.confirmTicket(numericId)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('tickets/:id')
  cancelTicket(@Param('id') id: string, @CurrentUser() user: any) {
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) {
      throw new ForbiddenException('ID de ticket inválido')
    }

    // If client, pass userId to restrict to own tickets
    if (user.role === 'client') {
      return this.loyaltyService.cancelTicket(numericId, user.sub)
    }

    if (user.role !== 'admin' && user.role !== 'seller') {
      throw new ForbiddenException('No tienes permisos para cancelar tickets')
    }

    return this.loyaltyService.cancelTicket(numericId)
  }

  @Get('public/exchange-rate')
  getExchangeRate() {
    return this.loyaltyService.getExchangeRate()
  }

  @Get('public/exchange-rate/historical')
  getHistoricalExchangeRate(@Query('date') date?: string) {
    return this.loyaltyService.getExchangeRateForDate(date)
  }

  @Get('public/business-status')
  getBusinessStatus() {
    return this.loyaltyService.getBusinessStatus()
  }

  @Get('public/pickup-locations')
  getPublicPickupLocations() {
    return this.loyaltyService.getPublicPickupLocations()
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/business-status')
  updateBusinessStatus(@Body() body: any, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin cambia horarios')
    }
    return this.loyaltyService.updateBusinessStatus(body)
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/pickup-locations')
  getAdminPickupLocations(@CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede ver ubicaciones de pick up')
    }
    return this.loyaltyService.getAdminPickupLocations()
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/pickup-locations')
  addPickupLocation(@Body() body: any, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede agregar ubicaciones de pick up')
    }
    return this.loyaltyService.addPickupLocation(body)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/pickup-locations/:id')
  removePickupLocation(@Param('id') id: string, @CurrentUser() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo admin puede eliminar ubicaciones de pick up')
    }
    return this.loyaltyService.removePickupLocation(id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('places/autocomplete')
  async autocompletePlaces(@Body() body: any) {
    return this.loyaltyService.proxyPlaceAutocomplete(body)
  }

  @Post('public/places/autocomplete')
  async autocompletePublicPlaces(@Body() body: any) {
    return this.loyaltyService.proxyPlaceAutocomplete(body)
  }

  @UseGuards(JwtAuthGuard)
  @Get('places/reverse-geocode')
  async reverseGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.loyaltyService.proxyReverseGeocode(lat, lng)
  }

  @Get('public/places/reverse-geocode')
  async reversePublicGeocode(@Query('lat') lat: string, @Query('lng') lng: string) {
    return this.loyaltyService.proxyReverseGeocode(lat, lng)
  }

  @UseGuards(JwtAuthGuard)
  @Get('places/:placeId')
  async getPlaceDetails(@Param('placeId') placeId: string) {
    return this.loyaltyService.proxyPlaceDetails(placeId)
  }

  // --- PUBLIC PLACES (Guest) ---
  @Get('public/places/:placeId')
  async getPublicPlaceDetails(@Param('placeId') placeId: string) {
    return this.loyaltyService.proxyPlaceDetails(placeId)
  }

  @UseGuards(JwtAuthGuard)
  @Get('locations')
  getLocations(@CurrentUser() user: any) {
    return this.loyaltyService.getLocations(user.sub)
  }

  @UseGuards(JwtAuthGuard)
  @Post('locations')
  addLocation(@Body() dto: any, @CurrentUser() user: any) {
    return this.loyaltyService.addLocation(user.sub, dto)
  }

  @UseGuards(JwtAuthGuard)
  @Patch('locations/:id/default')
  setDefaultLocation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.loyaltyService.setDefaultLocation(user.sub, id)
  }

  @UseGuards(JwtAuthGuard)
  @Delete('locations/:id')
  removeLocation(@Param('id') id: string, @CurrentUser() user: any) {
    return this.loyaltyService.removeLocation(user.sub, id)
  }
}
