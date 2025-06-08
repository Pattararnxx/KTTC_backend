import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';
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
  async searchByNameOrLastname(query: string): Promise<User[]> {
    return await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.firstname) LIKE :q', { q: `%${query.toLowerCase()}%` })
      .orWhere('LOWER(user.lastname) LIKE :q', {
        q: `%${query.toLowerCase()}%`,
      })
      .orWhere("LOWER(CONCAT(user.firstname, ' ', user.lastname)) LIKE :q", {
        q: `%${query.toLowerCase()}%`,
      })
      .getMany();
  }
  async findUnpaid(): Promise<User[]> {
    return this.userRepository.find({
      where: { is_paid: false },
    });
  }
  async approveUser(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    user.is_paid = true;
    return this.userRepository.save(user);
  }
  async getPaidPlayersWithoutGroups(): Promise<User[]> {
    return this.userRepository.find({
      where: {
        is_paid: true,
        group_name: IsNull(),
      },
      order: { category: 'ASC', createdAt: 'ASC' },
    });
  }
  async getGroupedPlayers(): Promise<Record<string, Record<string, User[]>>> {
    const players = await this.userRepository.find({
      where: {
        is_paid: true,
        group_name: Not(IsNull()),
      },
      order: { category: 'ASC', group_name: 'ASC' },
    });

    const grouped: Record<string, Record<string, User[]>> = {};

    for (const player of players) {
      if (!grouped[player.category]) {
        grouped[player.category] = {};
      }
      if (!grouped[player.category][player.group_name]) {
        grouped[player.category][player.group_name] = [];
      }
      grouped[player.category][player.group_name].push(player);
    }

    return grouped;
  }
  async assignGroups(
    assignments: { userId: number; groupName: string }[],
  ): Promise<void> {
    for (const assignment of assignments) {
      await this.userRepository.update(
        { id: assignment.userId },
        { group_name: assignment.groupName },
      );
    }
  }
}
