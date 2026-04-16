import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, Matches, IsBoolean, IsOptional } from 'class-validator';

export class CreateTimeslotDto {
  @ApiProperty({ example: '12:00:00', description: 'Start time in HH:mm:ss format' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm:ss format',
  })
  startTime: string;

  @ApiProperty({ example: '12:30:00', description: 'End time in HH:mm:ss format' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm:ss format',
  })
  endTime: string;

  @ApiProperty({ example: 50, description: 'Maximum capacity for this slot' })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  capacity: number;

  @ApiProperty({ example: 1, description: 'ID of the associated shift' })
  @IsNotEmpty()
  @IsInt()
  shiftId: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
