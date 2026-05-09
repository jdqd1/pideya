export interface Ingredient {
    id: string
    name: string
    cost: number // Cost per package
    packageSize: number // Total amount in package
    unit: string // e.g., 'g', 'ml', 'unit'
    type?: 'ingredient' | 'packaging' | 'service'
    createdAt: string
    updatedAt: string
}

export interface RecipeHistoryPoint {
    date: string
    cost: number
    price: number
    margin: number // Percentage
}

export interface RecipeIngredient {
    id: string
    recipeId: string
    ingredientId: string
    quantity: number // Amount used in recipe
    ingredient?: Ingredient
}

export interface Recipe {
    id: string
    name: string
    description?: string
    profitMargin: number // Percentage (0-100)
    yield: number // How many units/portions this recipe produces
    ingredients: RecipeIngredient[]
    createdAt: string
    updatedAt: string
    history?: RecipeHistoryPoint[]
    // Virtual properties for UI
    totalCost?: number
    suggestedPrice?: number
    grossProfit?: number
    mc?: number
    mcPercent?: number
    materialCost?: number
    linkedProductId?: string
    linkedProduct?: {
        id: string
        name: string
        imageUrl?: string | null
    }

}
