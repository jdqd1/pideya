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

@Entity({ name: 'expenses' })
export class Expense {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 255 })
    description!: string

    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    amount!: number

    @Column({ type: 'varchar', length: 12, default: 'USD' })
    currency!: string

    @Column({ type: 'numeric', precision: 12, scale: 4, nullable: true, transformer: numericTransformer })
    exchangeRate?: number | null

    @Column({ name: 'exchange_rate_date', type: 'date', nullable: true })
    exchangeRateDate?: string | null

    @Column({ name: 'payment_method', type: 'varchar', length: 50, nullable: true })
    paymentMethod?: string | null

    @Column({ type: 'varchar', length: 24, default: 'manual' })
    source!: string

    // 'inventory', 'payroll', 'utilities', 'other'
    @Column({ type: 'varchar', length: 50, default: 'other' })
    category!: string

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'recorded_by' })
    recordedBy?: User | null

    @Column({ type: 'timestamp' })
    occurredAt!: Date

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
