import { Controller, Post, Get, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import type { UserPayload } from './current-user.decorator';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

class RegisterDto {
  @IsEmail({}, { message: 'อีเมลไม่ถูกต้อง' })
  email: string;

  @IsNotEmpty({ message: 'ชื่อต้องไม่เป็นค่าว่าง' })
  name: string;

  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  pass: string;
}

class LoginDto {
  @IsEmail({}, { message: 'อีเมลไม่ถูกต้อง' })
  email: string;

  @MinLength(4, { message: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' })
  pass: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.name, body.pass);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.pass);
  }

  @Public()
  @Throttle({ default: { limit: 2, ttl: 3_600_000 } })
  @Post('demo')
  async demo() {
    return this.authService.demo();
  }

  @Public()
  @Get('config')
  getConfig() {
    return {
      enableDemo: this.authService.isDemoEnabled(),
      enableRegister: this.authService.isRegisterEnabled(),
    };
  }

  @Get('me')
  me(@CurrentUser() user: UserPayload) {
    return user;
  }

  @Post('clear')
  async clear(@CurrentUser() user: UserPayload) {
    await this.authService.clear(user.userId);
    return { success: true };
  }
}
