import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm'
import { User } from './user.entity'

export type ActivityType = 'WIN' | 'USE' | 'SEND' | 'RECEIVE' | 'LEVEL_UP' | 'LOGIN'

@Entity({ name: 'user_activity' })
export class UserActivity {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 20 })
    type!: ActivityType

    @Column({ type: 'jsonb', nullable: true })
    data?: Record<string, any>

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date
}
