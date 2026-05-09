import { IsString, Length } from 'class-validator'

export class ClaimDto {
  @IsString()
  @Length(4, 120)
  code!: string
}
