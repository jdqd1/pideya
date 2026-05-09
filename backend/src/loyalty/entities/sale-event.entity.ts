import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'
import { User } from './user.entity'
import { numericTransformer } from './column-transformers'

@Entity({ name: 'sale_events' })
export class SaleEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 180 })
  name!: string

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
  price!: number

  @Column({ type: 'int', default: 1 })
  quantity!: number

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  points?: number | null

  @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true, transformer: numericTransformer })
  exchangeRate?: number | null

  @Column({ name: 'exchange_rate_date', type: 'date', nullable: true })
  exchangeRateDate?: string | null

  @Column({ type: 'varchar', length: 12, default: 'USD' })
  currency!: string

  @Column({ type: 'varchar', length: 50, nullable: true })
  paymentMethod?: string | null

  @Column({ type: 'simple-json', nullable: true })
  paymentDetails?: {
    method: string
    amount: number
    currency?: string
    amountNative?: number
    currencyNative?: string
    amountUsd?: number
    exchangeRate?: number | null
  }[] | null



  @Column({ type: 'varchar', length: 24, default: 'pos' })
  source!: string

  @Column({ type: 'varchar', length: 120, nullable: true, unique: true })
  code?: string | null

  @Column({ type: 'text', array: true, nullable: true })
  codes?: string[] | null

  @Column({ type: 'varchar', length: 80, nullable: true })
  productId?: string | null

  @Column({ type: 'varchar', length: 180, nullable: true })
  customerEmail?: string | null

  @Column({ type: 'varchar', length: 80, nullable: true })
  customerId?: string | null

  @Column({ type: 'varchar', length: 180, nullable: true })
  customerName?: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  customerPhone?: string | null

  @Column({ type: 'varchar', length: 10, nullable: true })
  documentType?: string | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  documentNumber?: string | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by' })
  recordedBy?: User | null

  @Column({ type: 'timestamp' })
  occurredAt!: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date
}
