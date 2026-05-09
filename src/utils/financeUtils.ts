/**
 * Financial Utility Functions
 * Based on user notes for Recetario & Costos
 */

// --- Types ---
import type { Recipe } from "../types/recetario";

export interface FinancialMetrics {
    mc: number;         // Margen de Contribución ($)
    mcPercent: number;  // Margen de Contribución (%)
    pe: number;         // Punto de Equilibrio (Units)
    isRisky: boolean;   // MC% < 30%
    isGood: boolean;    // MC% > 50%
}

/**
 * Calculates the Contribution Margin (MC)
 * MC = Price - Variable Cost
 */
export const calculateMC = (price: number, variableCost: number): number => {
    return price - variableCost;
};

/**
 * Calculates the Contribution Margin Percentage (MC%)
 * MC% = MC / Price
 * Returns a value between 0 and 100
 */
export const calculateMCPercent = (mc: number, price: number): number => {
    if (price <= 0) return 0;
    return (mc / price) * 100;
};

/**
 * Calculates the Break-Even Point (PE) in Units
 * PE = Fixed Expenses / MC per Unit
 */
export const calculatePE = (fixedExpenses: number, mcPerUnit: number): number => {
    if (mcPerUnit <= 0) return Infinity; // If no margin, you never break even
    return Math.ceil(fixedExpenses / mcPerUnit);
};

/**
 * Evaluates the health of the product based on user guidelines
 * < 30% Risky
 * 30-50% Acceptable
 * > 50% Very Good
 */
export const getHealthStatus = (mcPercent: number): 'risky' | 'acceptable' | 'good' => {
    if (mcPercent < 30) return 'risky';
    if (mcPercent > 50) return 'good';
    return 'acceptable';
};

/**
 * Full Analysis Helper
 */
export const analyzeProduct = (price: number, variableCost: number, fixedExpenses: number): FinancialMetrics => {
    const mc = calculateMC(price, variableCost);
    const mcPercent = calculateMCPercent(mc, price);
    const pe = calculatePE(fixedExpenses, mc);
    const health = getHealthStatus(mcPercent);

    return {
        mc,
        mcPercent,
        pe,
        isRisky: health === 'risky',
        isGood: health === 'good'
    };
};

/**
 * Calculates the total cost of a recipe based on its ingredients.
 * Distinguishes between total cost (all ingredients) and material cost (non-service ingredients).
 */
export const calculateRecipeCosts = (recipe: Recipe): { totalCost: number; materialCost: number } => {
    let totalCost = 0;
    let materialCost = 0;

    if (!recipe.ingredients) return { totalCost: 0, materialCost: 0 };

    recipe.ingredients.forEach(ri => {
        const ing = ri.ingredient;
        if (ing) {
            // Cost per unit of the ingredient (e.g. $/g)
            const costPerUnit = ing.packageSize > 0 ? ing.cost / ing.packageSize : 0;
            // Cost for the amount used in recipe
            const cost = costPerUnit * ri.quantity;
            totalCost += cost;

            // Identify materials vs services
            // If type is missing, assume material (legacy behavior)
            if (!ing.type || ing.type !== 'service') {
                materialCost += cost;
            }
        }
    });

    return { totalCost, materialCost };
};

/**
 * Calculates the margin percentage based on cost and price.
 * Margin = (1 - Cost/Price) * 100
 */
export const calculateMarginFromPrice = (cost: number, price: number): number => {
    if (price <= 0.001) return 0;
    return (1 - (cost / price)) * 100;
};

/**
 * Utility to get the variable cost of a recipe (total cost of ingredients).
 * Used by SalesSection for financial analytics.
 */
export const calculateRecipeVariableCost = (recipe: Recipe): number => {
    return calculateRecipeCosts(recipe).totalCost;
};
