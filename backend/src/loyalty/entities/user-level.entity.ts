import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm'
import { User } from './user.entity'
import type { LevelId } from '../loyalty.rules'

@Entity({ name: 'user_levels' })
@Unique(['user'])
export class UserLevel {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({ name: 'level_id', type: 'varchar', length: 40 })
  levelId!: LevelId

  @Column({ name: 'points_in_window', type: 'float', default: 0 })
  pointsInWindow!: number

  @Column({ name: 'window_start', type: 'timestamp with time zone' })
  windowStart!: Date

  @Column({ name: 'window_end', type: 'timestamp with time zone' })
  windowEnd!: Date

  @Column({ name: 'awarded_at', type: 'timestamp with time zone' })
  awardedAt!: Date

  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt?: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
