import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { Repository } from "typeorm"
import { Ingredient } from "./entities/ingredient.entity"
import { Recipe } from "./entities/recipe.entity"
import { RecipeIngredient } from "./entities/recipe-ingredient.entity"
import { BusinessStatus } from "./entities/business-status.entity"
import { Product } from "./entities/product.entity"
import { SaleEvent } from "./entities/sale-event.entity"

@Injectable()
export class RecetarioService {
    constructor(
        @InjectRepository(Ingredient)
        private ingredientRepo: Repository<Ingredient>,
        @InjectRepository(Recipe)
        private recipeRepo: Repository<Recipe>,
        @InjectRepository(RecipeIngredient)
        private recipeIngredientRepo: Repository<RecipeIngredient>,
        @InjectRepository(BusinessStatus)
        private businessStatusRepo: Repository<BusinessStatus>,
        @InjectRepository(SaleEvent)
        private saleRepo: Repository<SaleEvent>,
    ) { }

    // --- INGREDIENTS ---

    async getAllIngredients(type?: string) {
        const where = type ? { type } : {}
        return this.ingredientRepo.find({ where, order: { name: "ASC" } })
    }

    async createIngredient(data: Partial<Ingredient>) {
        const ingredient = this.ingredientRepo.create(data)
        return this.ingredientRepo.save(ingredient)
    }

    async updateIngredient(id: string, data: Partial<Ingredient>) {
        await this.ingredientRepo.update(id, data)
        return this.ingredientRepo.findOneBy({ id })
    }

    async deleteIngredient(id: string) {
        return this.ingredientRepo.delete(id)
    }

    // --- RECIPES ---

    async getAllRecipes() {
        return this.recipeRepo.find({
            relations: ["ingredients", "ingredients.ingredient", "linkedProduct"],
            order: { name: "ASC" },
        })
    }

    async getRecipe(id: string) {
        return this.recipeRepo.findOne({
            where: { id },
            relations: ["ingredients", "ingredients.ingredient", "linkedProduct"],
        })
    }

    async createRecipe(data: { name: string; description?: string; profitMargin?: number; yield?: number; ingredients: { ingredientId: string; quantity: number }[]; history?: any[]; linkedProductId?: string }) {
        const recipe = this.recipeRepo.create({
            name: data.name,
            description: data.description,
            profitMargin: data.profitMargin,
            yield: data.yield || 1,
            history: data.history,
            linkedProductId: data.linkedProductId
        })
        const savedRecipe = await this.recipeRepo.save(recipe)

        if (data.ingredients && data.ingredients.length > 0) {
            const recipeIngredients = data.ingredients.map((ri) =>
                this.recipeIngredientRepo.create({
                    recipeId: savedRecipe.id,
                    ingredientId: ri.ingredientId,
                    quantity: ri.quantity,
                })
            )
            await this.recipeIngredientRepo.save(recipeIngredients)
        }

        return this.getRecipe(savedRecipe.id)
    }

    async updateRecipe(id: string, data: { name?: string; description?: string; profitMargin?: number; yield?: number; ingredients?: { ingredientId: string; quantity: number }[]; history?: any[]; linkedProductId?: string }) {
        const recipe = await this.recipeRepo.findOneBy({ id })
        if (!recipe) {
            throw new Error("Recipe not found")
        }

        if (data.name !== undefined) recipe.name = data.name
        if (data.description !== undefined) recipe.description = data.description
        if (data.profitMargin !== undefined) recipe.profitMargin = data.profitMargin
        if (data.yield !== undefined) recipe.yield = data.yield
        if (data.history !== undefined) recipe.history = data.history
        if (data.linkedProductId !== undefined) recipe.linkedProductId = data.linkedProductId

        await this.recipeRepo.save(recipe)

        if (data.ingredients) {
            await this.recipeIngredientRepo.delete({ recipeId: id })

            const recipeIngredients = data.ingredients.map((ri) =>
                this.recipeIngredientRepo.create({
                    recipeId: id,
                    ingredientId: ri.ingredientId,
                    quantity: ri.quantity,
                })
            )
            await this.recipeIngredientRepo.save(recipeIngredients)
        }

        return this.getRecipe(id)
    }

    async deleteRecipe(id: string) {
        return this.recipeRepo.delete(id)
    }

    // --- CONFIGURATION ---

    async getFinancialConfig() {
        // Assume singleton with ID 1, or find first
        const status = await this.businessStatusRepo.findOne({ where: {} })
        if (!status) {
            // Create default if missing
            const newStatus = this.businessStatusRepo.create({ fixedExpenses: 0 })
            return this.businessStatusRepo.save(newStatus)
        }
        return status
    }

    async updateFinancialConfig(fixedExpenses: number) {
        const status = await this.businessStatusRepo.findOne({ where: {} })
        if (status) {
            status.fixedExpenses = fixedExpenses
            return this.businessStatusRepo.save(status)
        }
        // Should exist, but handling case
        const newStatus = this.businessStatusRepo.create({ fixedExpenses })
        return this.businessStatusRepo.save(newStatus)
    }

    // --- ANALYSIS & SALES ---

    async getRecipeAnalysis(id: string) {
        const recipe = await this.getRecipe(id)
        if (!recipe) throw new Error("Recipe not found")

        let salesHistory: any[] = []

        if (recipe.linkedProductId) {
            // Fetch raw sales for the linked product
            // We return individual sales so the client can aggregate them by local timezone
            const rawData = await this.saleRepo.find({
                where: { productId: recipe.linkedProductId },
                select: ["occurredAt", "quantity", "price"],
                order: { occurredAt: "ASC" }
            })

            salesHistory = rawData.map(sale => ({
                occurredAt: sale.occurredAt,
                quantity: Number(sale.quantity ?? 1),
                price: Number(sale.price)
            }))
        }

        return {
            recipe,
            salesHistory
        }
    }
}
