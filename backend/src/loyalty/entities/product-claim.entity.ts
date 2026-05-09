import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { User } from './user.entity'
import { Product } from './product.entity'
import { numericTransformer } from './column-transformers'

export type ProductClaimStatus = 'available' | 'claimed'

@Entity({ name: 'product_claims' })
export class ProductClaim {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  code!: string

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status!: ProductClaimStatus

  @Column({ type: 'float', default: 1 })
  points!: number

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product?: Product | null

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId?: string | null

  @Column({ name: 'product_name', type: 'varchar', length: 180, nullable: true })
  productName?: string | null

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  price?: number | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'claimed_by' })
  claimedBy?: User | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @Column({ name: 'claimed_at', type: 'timestamp', nullable: true })
  claimedAt?: Date | null
}
