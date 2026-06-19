import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { PortfoliosService } from './portfolios.service';
import { CurrentUser, UserPayload } from '../auth/current-user.decorator';
import { IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

class CreatePortfolioDto {
  @IsNotEmpty({ message: 'ชื่อพอร์ตห้ามเป็นค่าว่าง' })
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  color?: number;
}

class UpdatePortfolioDto {
  @IsNotEmpty({ message: 'ชื่อพอร์ตห้ามเป็นค่าว่าง' })
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  color?: number;
}

@Controller('portfolios')
export class PortfoliosController {
  constructor(private portfoliosService: PortfoliosService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.portfoliosService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.portfoliosService.findOne(id, user.userId);
  }

  @Post()
  async create(@Body() body: CreatePortfolioDto, @CurrentUser() user: any) {
    return this.portfoliosService.create(user.userId, body.name, body.color);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdatePortfolioDto,
    @CurrentUser() user: any,
  ) {
    return this.portfoliosService.update(id, user.userId, body.name, body.color);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    await this.portfoliosService.remove(id, user.userId);
    return { success: true };
  }
}
