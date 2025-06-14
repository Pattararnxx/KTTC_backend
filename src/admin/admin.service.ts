import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Admin } from './entities/admin.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    @Inject('ADMIN_REPOSITORY')
    private adminRepository: Repository<Admin>,
  ) {}
  async create(createAdminDto: CreateAdminDto): Promise<Admin> {
    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    const admin = {
      ...createAdminDto,
      password: hashedPassword,
    };

    return this.adminRepository.save(admin);
  }
  async findOne(username: string): Promise<Admin | null> {
    return this.adminRepository.findOne({ where: { username } });
  }
}
