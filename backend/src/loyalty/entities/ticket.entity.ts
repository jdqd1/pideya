import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm'
import { User } from './user.entity'
import { numericTransformer } from './column-transformers'

export type TicketStatus = 'pending' | 'confirmed' | 'rejected'

@Entity({ name: 'tickets' })
export class Ticket {
    @PrimaryGeneratedColumn('increment')
    id!: number

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'user_id' })
    user?: User | null

    @Column({ name: 'customer_email', nullable: true })
    customerEmail?: string

    @Column({ type: 'numeric', precision: 12, scale: 2, transformer: numericTransformer })
    amount!: number

    @Column({ length: 10, default: 'USD' })
    currency!: string

    @Column({ name: 'exchange_rate', type: 'numeric', precision: 12, scale: 4, nullable: true, transformer: numericTransformer })
    exchangeRate?: number | null

    @Column({ name: 'exchange_rate_date', type: 'date', nullable: true })
    exchangeRateDate?: string | null

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status!: TicketStatus

    @Column({ nullable: true })
    reference?: string

    // Storing items as JSON for simplicity as per requirement context
    @Column({ type: 'simple-json', nullable: true })
    items?: any

    // Storing delivery location as JSON
    @Column({ name: 'delivery_location', type: 'simple-json', nullable: true })
    deliveryLocation?: any

    @Column({ name: 'coupon_code', nullable: true })
    couponCode?: string

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    discount!: number

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: numericTransformer })
    points!: number

    @Column({ nullable: true })
    bank?: string

    @Column({ nullable: true })
    phone?: string

    @Column({ name: 'document_type', nullable: true })
    documentType?: string

    @Column({ name: 'document_number', nullable: true })
    documentNumber?: string

    @Column({ name: 'customer_name', nullable: true })
    customerName?: string

    @Column({ name: 'confirmed_at', type: 'timestamp', nullable: true })
    confirmedAt?: Date | null

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
