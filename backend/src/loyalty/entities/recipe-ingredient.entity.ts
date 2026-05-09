import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm"
import { Recipe } from "./recipe.entity"
import { Ingredient } from "./ingredient.entity"

@Entity()
export class RecipeIngredient {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column()
    recipeId!: string

    @Column()
    ingredientId!: string

    @Column({ type: "decimal", precision: 10, scale: 2 })
    quantity!: number // Amount used in the recipe

    @ManyToOne(() => Recipe, (recipe) => recipe.ingredients, { onDelete: "CASCADE" })
    @JoinColumn({ name: "recipeId" })
    recipe!: Recipe

    @ManyToOne(() => Ingredient, (ingredient) => ingredient.recipeIngredients)
    @JoinColumn({ name: "ingredientId" })
    ingredient!: Ingredient
}
