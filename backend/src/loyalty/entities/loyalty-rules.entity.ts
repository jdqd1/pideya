import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import type { LoyaltyRulesResponse } from '../loyalty.rules'

@Entity({ name: 'loyalty_rules_config' })
export class LoyaltyRulesConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'jsonb' })
  rules!: LoyaltyRulesResponse

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
