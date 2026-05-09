import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm'
import { numericTransformer } from './column-transformers'

@Entity({ name: 'exchange_rates' })
export class ExchangeRate {
  @PrimaryColumn({ type: 'date' })
  date!: string

  @Column({ type: 'numeric', precision: 12, scale: 4, transformer: numericTransformer })
  rate!: number

  @Column({ type: 'varchar', length: 50, default: 'official' })
  source!: string

  @Column({ name: 'fetched_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fetchedAt!: Date

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
