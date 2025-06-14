import { Injectable } from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { JwtService } from '@nestjs/jwt';
import { Admin } from '../admin/entities/admin.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private adminService: AdminService,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    username: string,
    pass: string,
  ): Promise<Omit<Admin, 'password'> | null> {
    const user = await this.adminService.findOne(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  login(admin: Admin) {
    const payload = { sub: admin.username };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
