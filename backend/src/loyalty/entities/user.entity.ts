import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Location } from './location.entity'
import { PushSubscription } from './push-subscription.entity'

export type UserRole = 'client' | 'seller' | 'admin'

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string | null

  @Column({ type: 'varchar', length: 30, unique: true, nullable: true })
  cedula?: string | null

  @Column({ name: 'phone_number', type: 'varchar', length: 20, nullable: true })
  phoneNumber?: string | null

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash?: string | null

  @Column({ name: 'reset_code', type: 'varchar', length: 255, nullable: true })
  resetCode?: string | null

  @Column({ name: 'reset_code_expires_at', type: 'timestamp', nullable: true })
  resetCodeExpiresAt?: Date | null

  @Column({ type: 'varchar', length: 20, default: 'client' })
  role!: UserRole

  @Column({ name: 'is_provisional', type: 'boolean', default: false })
  isProvisional!: boolean

  @Column({ name: 'provisional_expires_at', type: 'timestamp', nullable: true })
  provisionalExpiresAt?: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @OneToMany(() => Location, (location) => location.user)
  locations?: Location[]

  @Column({ name: 'has_seen_welcome', type: 'boolean', default: false })
  hasSeenWelcome!: boolean

  @Column({ name: 'has_seen_first_coupon', type: 'boolean', default: false })
  hasSeenFirstCoupon!: boolean

  @Column({ name: 'last_gift_seen_at', type: 'timestamp', nullable: true })
  lastGiftSeenAt?: Date | null

  @OneToMany('PushSubscription', (sub: any) => sub.user)
  pushSubscriptions?: any[]
}
