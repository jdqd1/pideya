import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from "@nestjs/common"
import { RecetarioService } from "./recetario.service"
import { JwtAuthGuard } from "../auth/jwt.guard"

@Controller("recetario")
export class RecetarioController {
    constructor(private readonly service: RecetarioService) { }

    // Ingredients
    @Get("ingredients")
    async getAllIngredients(@Query("type") type?: string) {
        return this.service.getAllIngredients(type)
    }

    @Post("ingredients")
    @UseGuards(JwtAuthGuard)
    async createIngredient(@Body() body: any) {
        return this.service.createIngredient(body)
    }

    @Put("ingredients/:id")
    @UseGuards(JwtAuthGuard)
    async updateIngredient(@Param("id") id: string, @Body() body: any) {
        return this.service.updateIngredient(id, body)
    }

    @Delete("ingredients/:id")
    @UseGuards(JwtAuthGuard)
    async deleteIngredient(@Param("id") id: string) {
        return this.service.deleteIngredient(id)
    }

    // Recipes
    @Get("recipes")
    async getAllRecipes() {
        return this.service.getAllRecipes()
    }

    @Get("recipes/:id")
    async getRecipe(@Param("id") id: string) {
        return this.service.getRecipe(id)
    }

    @Get("recipes/:id/analysis")
    async getRecipeAnalysis(@Param("id") id: string) {
        return this.service.getRecipeAnalysis(id)
    }

    @Post("recipes")
    @UseGuards(JwtAuthGuard)
    async createRecipe(@Body() body: any) {
        return this.service.createRecipe(body)
    }

    @Put("recipes/:id")
    @UseGuards(JwtAuthGuard)
    async updateRecipe(@Param("id") id: string, @Body() body: any) {
        return this.service.updateRecipe(id, body)
    }

    @Delete("recipes/:id")
    @UseGuards(JwtAuthGuard)
    async deleteRecipe(@Param("id") id: string) {
        return this.service.deleteRecipe(id)
    }

    // Configuration
    @Get("config")
    async getConfig() {
        return this.service.getFinancialConfig()
    }

    @Put("config")
    @UseGuards(JwtAuthGuard)
    async updateConfig(@Body() body: { fixedExpenses: number }) {
        return this.service.updateFinancialConfig(body.fixedExpenses)
    }
}
