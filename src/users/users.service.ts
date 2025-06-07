import { Injectable, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

type CreateUserData = Omit<User, 'id' | 'created_at'>;

@Injectable()
export class UsersService {
  constructor(
    @Inject('USERS_REPOSITORY')
    private readonly userRepository: Repository<User>,
  ) {}

  async create(data: CreateUserDto, file: Express.Multer.File): Promise<User> {
    const userData: Partial<CreateUserData> = {
      firstname: data.firstname,
      lastname: data.lastname,
      affiliation: data.affiliation !== '-' ? data.affiliation : undefined,
      seed_rank:
        data.seed_rank !== '-' &&
        data.seed_rank !== undefined &&
        data.seed_rank !== null
          ? Number(data.seed_rank)
          : null,
      category: data.category,
      slip_filename: file.filename,
      is_paid: false,
    };

    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }
}
