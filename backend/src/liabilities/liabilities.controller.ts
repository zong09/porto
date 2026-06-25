import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { LiabilitiesService } from './liabilities.service';
import { CurrentUser, UserPayload } from '../auth/current-user.decorator';
import { IsNotEmpty, IsNumber, Min, IsOptional, IsString } from 'class-validator';

class CreateLiabilityDto {
  @IsNotEmpty({ message: 'ชื่อหนี้สินห้ามเป็นค่าว่าง' })
  name: string;

  @IsNumber({}, { message: 'ยอดหนี้สินต้องเป็นตัวเลข' })
  @Min(0, { message: 'ยอดหนี้สินต้องไม่ต่ำกว่า 0' })
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

class UpdateLiabilityDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber({}, { message: 'ยอดหนี้สินต้องเป็นตัวเลข' })
  @Min(0, { message: 'ยอดหนี้สินต้องไม่ต่ำกว่า 0' })
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

@Controller('liabilities')
export class LiabilitiesController {
  constructor(private liabilitiesService: LiabilitiesService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.liabilitiesService.findAll(user.userId);
  }

  @Post()
  async create(@Body() body: CreateLiabilityDto, @CurrentUser() user: any) {
    return this.liabilitiesService.create(user.userId, body.name, body.amount, body.currency);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateLiabilityDto,
    @CurrentUser() user: any,
  ) {
    return this.liabilitiesService.update(id, user.userId, body.name, body.amount, body.currency);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    await this.liabilitiesService.remove(id, user.userId);
    return { success: true };
  }
}
