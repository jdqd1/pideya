import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './user.entity'

@Entity({ name: 'push_subscriptions' })
export class PushSubscription {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column()
    endpoint!: string

    @Column({ type: 'int8', nullable: true })
    expirationTime?: number | null

    @Column('jsonb')
    keys!: {
        p256dh: string
        auth: string
    }

    @ManyToOne(() => User, (user) => user.pushSubscriptions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User

    @Column({ name: 'user_id' })
    userId!: string
}
