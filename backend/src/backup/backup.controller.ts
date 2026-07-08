import { Controller, Post, Body } from '@nestjs/common';
import { BackupService } from './backup.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

class PasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่าน' })
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  password: string;
}

class ImportDto {
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่าน' })
  password: string; // Will also validate min length but on import if wrong it's wrong

  @IsString()
  @IsNotEmpty({ message: 'กรุณาแนบไฟล์ Backup' })
  data: string; // base64 encoded file data
}

@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post('export')
  async exportData(@Body() body: PasswordDto, @CurrentUser() user: any) {
    const buffer = await this.backupService.exportData(
      user.userId,
      body.password,
    );
    // Return base64 string, frontend will decode and download as file
    return { data: buffer.toString('base64') };
  }

  @Post('import')
  async importData(@Body() body: ImportDto, @CurrentUser() user: any) {
    const buffer = Buffer.from(body.data, 'base64');
    await this.backupService.importData(user.userId, buffer, body.password);
    return { success: true };
  }
}
