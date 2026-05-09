import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class RegisterExpenseDto {
    @IsString()
    @IsNotEmpty()
    description!: string

    @IsNumber()
    amount!: number

    @IsString()
    @IsOptional()
    currency?: string

    @IsString()
    @IsOptional()
    category?: string

    @IsString()
    @IsOptional()
    occurredAt?: string

    @IsNumber()
    @IsOptional()
    exchangeRate?: number

    @IsString()
    @IsOptional()
    paymentMethod?: string
}
