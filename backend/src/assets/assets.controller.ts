import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CurrentUser, UserPayload } from '../auth/current-user.decorator';
import { IsNotEmpty, IsEnum, IsOptional, IsString, IsNumber, IsUUID, IsArray, IsIn } from 'class-validator';

class CreateAssetDto {
  @IsUUID(4, { message: 'portfolioId ต้องเป็น UUID ที่ถูกต้อง' })
  portfolioId: string;

  @IsEnum(['crypto', 'th', 'us', 'fund', 'deposit'], { message: 'ประเภทสินทรัพย์ไม่ถูกต้อง' })
  type: 'crypto' | 'th' | 'us' | 'fund' | 'deposit';

  @IsNotEmpty({ message: 'Symbol ห้ามเป็นค่าว่าง' })
  symbol: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(['THB', 'USD'], { message: 'ค่าเงินไม่ถูกต้อง' })
  currency: 'THB' | 'USD';

  @IsOptional()
  @IsString()
  cgId?: string;

  @IsOptional()
  @IsString()
  yahooSymbol?: string;

  @IsOptional()
  @IsNumber()
  manualPrice?: number;

  @IsOptional()
  @IsIn(['long', 'short'], { message: 'direction ต้องเป็น long หรือ short' })
  direction?: 'long' | 'short';
}

class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  manualPrice?: number;
}

class ReorderAssetsDto {
  @IsArray()
  @IsUUID(4, { each: true })
  orderedIds: string[];
}

@Controller('assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.assetsService.findAll(user.userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.assetsService.findOne(id, user.userId);
  }

  @Post()
  async create(@Body() body: CreateAssetDto, @CurrentUser() user: any) {
    return this.assetsService.create(
      user.userId,
      body.portfolioId,
      body.type,
      body.symbol,
      body.name || '',
      body.currency,
      body.cgId,
      body.yahooSymbol,
      body.manualPrice,
      body.direction,
    );
  }

  @Patch('reorder')
  async reorder(@Body() body: ReorderAssetsDto, @CurrentUser() user: any) {
    await this.assetsService.reorder(user.userId, body.orderedIds);
    return { success: true };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAssetDto,
    @CurrentUser() user: any,
  ) {
    return this.assetsService.update(id, user.userId, body.name, body.manualPrice);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    await this.assetsService.remove(id, user.userId);
    return { success: true };
  }
}
