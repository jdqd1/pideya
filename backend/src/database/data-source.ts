import { DataSource } from 'typeorm'
import { getDatabaseUrl, loadLocalEnv } from '../config/env'
import { User } from '../loyalty/entities/user.entity'
import { ProductClaim } from '../loyalty/entities/product-claim.entity'
import { Coupon } from '../loyalty/entities/coupon.entity'
import { UserLevel } from '../loyalty/entities/user-level.entity'
import { UserActivity } from '../loyalty/entities/user-activity.entity'
import { PushSubscription } from '../loyalty/entities/push-subscription.entity'
import { Location } from '../loyalty/entities/location.entity'
import { Ingredient } from '../loyalty/entities/ingredient.entity'
import { Recipe } from '../loyalty/entities/recipe.entity'
import { RecipeIngredient } from '../loyalty/entities/recipe-ingredient.entity'
import { BusinessStatus } from '../loyalty/entities/business-status.entity'
import { LoyaltyRulesConfig } from '../loyalty/entities/loyalty-rules.entity'
import { PickupLocation } from '../loyalty/entities/pickup-location.entity'
import { Ticket } from '../loyalty/entities/ticket.entity'
import { SaleEvent } from '../loyalty/entities/sale-event.entity'
import { Expense } from '../loyalty/entities/expense.entity'
import { Product } from '../loyalty/entities/product.entity'
import { ExchangeRate } from '../loyalty/entities/exchange-rate.entity'
import { CashClosure } from '../loyalty/entities/cash-closure.entity'

loadLocalEnv()

const isSsl = process.env.DB_SSL !== 'false'
const sslOptions = isSsl ? { rejectUnauthorized: false } : false

const entities = [
  User,
  PushSubscription,
  ProductClaim,
  Coupon,
  UserLevel,
  UserActivity,
  Ticket,
  Location,
  Ingredient,
  Recipe,
  RecipeIngredient,
  SaleEvent,
  BusinessStatus,
  Expense,
  LoyaltyRulesConfig,
  PickupLocation,
  Product,
  ExchangeRate,
  CashClosure,
]

const AppDataSource = new DataSource({
  type: 'postgres',
  url: getDatabaseUrl(),
  entities,
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  ssl: sslOptions,
  extra: isSsl ? { ssl: sslOptions } : undefined,
})

export default AppDataSource
