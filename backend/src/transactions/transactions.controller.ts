import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CurrentUser, UserPayload } from '../auth/current-user.decorator';
import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  IsUUID,
  IsString,
} from 'class-validator';

class CreateTransactionDto {
  @IsUUID(4, { message: 'assetId ต้องเป็น UUID ที่ถูกต้อง' })
  assetId: string;

  @IsEnum(['buy', 'sell', 'deposit', 'withdraw'], {
    message: 'ประเภทรายการไม่ถูกต้อง',
  })
  side: 'buy' | 'sell' | 'deposit' | 'withdraw';

  @IsNumber({}, { message: 'จำนวนต้องเป็นตัวเลข' })
  @Min(0.00000001, { message: 'จำนวนต้องมากกว่า 0' })
  quantity: number;

  @IsOptional()
  @IsNumber({}, { message: 'ราคาต้องเป็นตัวเลข' })
  @Min(0, { message: 'ราคาต้องไม่ต่ำกว่า 0' })
  price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'ค่าธรรมเนียมต้องเป็นตัวเลข' })
  @Min(0, { message: 'ค่าธรรมเนียมต้องไม่ต่ำกว่า 0' })
  fee?: number;

  @IsOptional()
  @IsString()
  date?: string;
}

@Controller('transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.transactionsService.findAll(user.userId);
  }

  @Post()
  async create(@Body() body: CreateTransactionDto, @CurrentUser() user: any) {
    return this.transactionsService.create(
      user.userId,
      body.assetId,
      body.side,
      body.quantity,
      body.price || 0,
      body.fee || 0,
      body.date || '',
    );
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateTransactionDto,
    @CurrentUser() user: any,
  ) {
    return this.transactionsService.update(
      id,
      user.userId,
      body.assetId,
      body.side,
      body.quantity,
      body.price || 0,
      body.fee || 0,
      body.date || '',
    );
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    await this.transactionsService.remove(id, user.userId);
    return { success: true };
  }
}
