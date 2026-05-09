
import { Column, CreateDateColumn, Entity, ManyToOne, JoinColumn, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User } from './user.entity'

@Entity({ name: 'locations' })
export class Location {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ name: 'user_id' })
    userId!: string

    @ManyToOne(() => User, (user) => user.locations, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User

    @Column({ type: 'float' })
    lat!: number

    @Column({ type: 'float' })
    lng!: number

    @Column({ type: 'varchar', nullable: true })
    name?: string

    @Column({ type: 'varchar', nullable: true })
    address?: string

    @Column({ type: 'varchar', nullable: true })
    villa?: string

    @Column({ type: 'varchar', nullable: true })
    reference?: string

    @Column({ type: 'varchar', default: 'manual' })
    source?: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date
}
