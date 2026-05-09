import { IsArray, IsOptional, IsString } from 'class-validator'

export class ClearClaimsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  codes?: string[]
}
