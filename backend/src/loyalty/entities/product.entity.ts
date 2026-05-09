import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm'
import { numericTransformer } from './column-transformers'

@Entity({ name: 'products' })
@Index('IDX_products_active_name', ['active', 'name'])
export class Product {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 180 })
    name!: string

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    price!: number

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    points!: number

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    cost!: number


    @Column({ type: 'int', default: 0 })
    stock!: number

    @Column({ type: 'boolean', default: true })
    active!: boolean

    @Column({ type: 'text', nullable: true })
    imageUrl?: string | null

    @Column({ type: 'text', nullable: true })
    description?: string | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
