
import { IsNumber, IsOptional, IsString } from 'class-validator'

export class CreateLocationDto {
    @IsNumber()
    lat!: number

    @IsNumber()
    lng!: number

    @IsString()
    @IsOptional()
    name?: string

    @IsString()
    @IsOptional()
    address?: string

    @IsString()
    @IsOptional()
    villa?: string

    @IsString()
    @IsOptional()
    reference?: string

    @IsString()
    @IsOptional()
    source?: string
}
