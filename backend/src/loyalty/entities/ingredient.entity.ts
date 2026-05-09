import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { RecipeIngredient } from "./recipe-ingredient.entity"

@Entity()
export class Ingredient {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column()
    name!: string

    @Column({ type: "decimal", precision: 10, scale: 2 })
    cost!: number

    @Column({ type: "decimal", precision: 10, scale: 2 })
    packageSize!: number // e.g., 1000 for 1kg

    @Column({ default: "g" })
    unit!: string // e.g., 'g', 'ml', 'unit'

    @Column({ default: "ingredient" })
    type!: string // 'ingredient' | 'packaging'

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date

    @OneToMany(() => RecipeIngredient, (ri) => ri.ingredient)
    recipeIngredients!: RecipeIngredient[]
}
