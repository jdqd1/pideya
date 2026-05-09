import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BusinessStatus {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ default: '13:00' })
    startHour!: string;

    @Column({ default: '21:00' })
    endHour!: string;

    @Column({ default: false })
    isForcedClosed!: boolean;

    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    fixedExpenses!: number;
}
