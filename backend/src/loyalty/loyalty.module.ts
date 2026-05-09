import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PushSubscription } from './entities/push-subscription.entity'
import { LoyaltyController } from './loyalty.controller'
import { LoyaltyService } from './loyalty.service'
import { User } from './entities/user.entity'
import { ProductClaim } from './entities/product-claim.entity'
import { Product } from './entities/product.entity'
import { Coupon } from './entities/coupon.entity'
import { UserLevel } from './entities/user-level.entity'
import { UserActivity } from './entities/user-activity.entity'
import { AuthModule } from '../auth/auth.module'

import { Ticket } from './entities/ticket.entity'

import { Location } from './entities/location.entity'

import { Ingredient } from './entities/ingredient.entity'
import { Recipe } from './entities/recipe.entity'
import { RecipeIngredient } from './entities/recipe-ingredient.entity'
import { SaleEvent } from './entities/sale-event.entity'
import { RecetarioService } from './recetario.service'
import { RecetarioController } from './recetario.controller'
import { ProductsController, PublicProductsController } from './products.controller'
import { ProductsService } from './products.service'

import { BusinessStatus } from './entities/business-status.entity'
import { Expense } from './entities/expense.entity'
import { LoyaltyRulesConfig } from './entities/loyalty-rules.entity'
import { PickupLocation } from './entities/pickup-location.entity'
import { ExchangeRate } from './entities/exchange-rate.entity'
import { CashClosure } from './entities/cash-closure.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User, PushSubscription, ProductClaim, Product, Coupon, UserLevel, UserActivity, Ticket, Location, Ingredient, Recipe, RecipeIngredient, SaleEvent, BusinessStatus, Expense, LoyaltyRulesConfig, PickupLocation, ExchangeRate, CashClosure]), AuthModule],
  providers: [LoyaltyService, RecetarioService, ProductsService],
  controllers: [LoyaltyController, RecetarioController, ProductsController, PublicProductsController],
})
export class LoyaltyModule { }
