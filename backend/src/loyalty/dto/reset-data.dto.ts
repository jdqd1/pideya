import { IsIn, IsISO8601, IsOptional } from 'class-validator'

export class ResetDataDto {
  @IsOptional()
  @IsIn(['all', 'range'])
  mode?: 'all' | 'range'

  @IsOptional()
  @IsISO8601()
  start?: string

  @IsOptional()
  @IsISO8601()
  end?: string
}
