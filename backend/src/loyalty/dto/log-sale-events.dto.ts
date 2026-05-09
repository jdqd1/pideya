import { IsOptional, IsString } from 'class-validator'
import { RegisterSaleDto } from './register-sale.dto'

export class LogSaleEventsDto extends RegisterSaleDto {
  @IsOptional()
  @IsString()
  source?: string

  @IsOptional()
  @IsString()
  occurredAt?: string
}
