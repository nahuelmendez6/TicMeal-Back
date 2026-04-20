import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsInt,
  IsArray,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEnum(['super_admin', 'company_admin', 'diner', 'kitchen', 'kitchen_admin'])
  role?: string;

  @IsOptional()
  @Matches(/^\d{4}$/, {
    message: 'El PIN debe tener exactamente 4 dígitos numéricos',
  })
  pin?: string;

  @IsOptional()
  @IsInt()
  companyId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  observationIds: number[];
}
