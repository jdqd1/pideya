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

@Entity({ name: 'cash_closures' })
export class CashClosure {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'business_date', type: 'date' })
    businessDate!: string

    @Column({ name: 'exchange_rate', type: 'numeric', precision: 12, scale: 4, nullable: true, transformer: numericTransformer })
    exchangeRate?: number | null

    @Column({ name: 'expected_usd', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    expectedUsd!: number

    @Column({ name: 'expected_ves', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
    expectedVes!: number

    @Column({ name: 'counted_usd', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    countedUsd!: number

    @Column({ name: 'counted_ves', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
    countedVes!: number

    @Column({ name: 'diff_usd', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    diffUsd!: number

    @Column({ name: 'diff_ves', type: 'numeric', precision: 14, scale: 2, default: 0, transformer: numericTransformer })
    diffVes!: number

    @Column({ name: 'difference_count', type: 'int', default: 0 })
    differenceCount!: number

    @Column({ type: 'simple-json', nullable: true })
    lines?: any[] | null

    @Column({ type: 'text', nullable: true })
    note?: string | null

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'closed_by' })
    closedBy?: User | null

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
