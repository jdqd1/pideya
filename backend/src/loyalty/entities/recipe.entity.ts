import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { RecipeIngredient } from "./recipe-ingredient.entity"
import { Product } from "./product.entity"
import { JoinColumn, ManyToOne } from "typeorm"

@Entity()
export class Recipe {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column()
    name!: string

    @Column({ type: "text", nullable: true })
    description!: string

    @Column({ type: "decimal", precision: 5, scale: 2, default: 30 })
    profitMargin!: number // Percentage, e.g., 30.00 for 30%

    @Column({ nullable: true })
    linkedProductId?: string | null // Link to Product entity for sales tracking

    @ManyToOne(() => Product, { nullable: true })
    @JoinColumn({ name: "linkedProductId" })
    linkedProduct?: Product


    @OneToMany(() => RecipeIngredient, (ri) => ri.recipe, { cascade: true })
    ingredients!: RecipeIngredient[]

    @Column({ type: "decimal", precision: 10, scale: 2, default: 1.00 })
    yield!: number // How many units/portions this recipe produces

    @Column({ type: "simple-json", nullable: true })
    history?: any[]

    @CreateDateColumn()
    createdAt!: Date

    @UpdateDateColumn()
    updatedAt!: Date
}
