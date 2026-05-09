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

export type CouponStatus = 'available' | 'used' | 'expired'
export type CouponKind = 'free-item' | 'percent' | 'bogo' | 'combo'

@Entity({ name: 'coupons' })
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column()
  title!: string

  @Column({ type: 'varchar', length: 12 })
  kind!: CouponKind

  @Column({ nullable: true, type: 'int' })
  threshold?: number | null

  @Column({ nullable: true, type: 'int' })
  value?: number | null

  @Column({ name: 'cap_usd', nullable: true, type: 'numeric', precision: 8, scale: 2 })
  capUsd?: number | null

  @Column({ type: 'varchar', length: 16, default: 'available' })
  status!: CouponStatus

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt?: Date | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'verified_by' })
  verifiedBy?: User | null

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt?: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
