import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UpdateMatchScoreDto } from './dto/update-match-score.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('slip_url', {
      storage: diskStorage({
        destination: './uploads/slips',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `slip-${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async register(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: CreateUserDto,
  ) {
    return this.usersService.create(body, file);
  }

  @Get('payments/search')
  async searchPayment(@Query('query') query: string): Promise<Partial<User>[]> {
    if (!query) return [];
    const users = await this.usersService.searchByNameOrLastname(query);
    return users.map((u) => ({
      firstname: u.firstname,
      lastname: u.lastname,
      is_paid: u.is_paid,
    }));
  }

  @Get('unpaid')
  findUnpaid(): Promise<User[]> {
    return this.usersService.findUnpaid();
  }

  @Patch(':id/approve')
  approveUser(@Param('id') id: string): Promise<User> {
    return this.usersService.approveUser(+id);
  }

  @Get('groups/available')
  async getAvailableForGrouping(): Promise<User[]> {
    return this.usersService.getPaidPlayersWithoutGroups();
  }

  @Get('groups')
  async getGroupedPlayers() {
    return this.usersService.getGroupedPlayers();
  }

  @Post('groups/assign')
  async assignGroups(
    @Body() body: { assignments: { userId: number; groupName: string }[] },
  ) {
    await this.usersService.assignGroups(body.assignments);
    return { message: 'Groups assigned successfully' };
  }

  @Post('tournament/create-draw')
  async createTournamentDraw() {
    try {
      await this.usersService.createTournamentWithDraw();
      return { message: 'Tournament matches created successfully' };
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw new BadRequestException('Failed to create tournament matches');
    }
  }

  @Get('matches')
  async getMatches(
    @Query('category') category?: string,
    @Query('group') groupName?: string,
    @Query('round') round?: string | string[],
  ) {
    const filters: {
      category?: string;
      groupName?: string;
      round?: string;
      rounds?: string[];
    } = { category };

    if (round === 'group' && groupName) {
      filters.groupName = groupName;
      filters.round = 'group';
    } else if (Array.isArray(round)) {
      filters.rounds = round;
    } else if (round === 'bracket') {
      filters.rounds = ['round16', 'quarter', 'semi', 'final'];
    } else if (typeof round === 'string') {
      filters.round = round;
    }

    return this.usersService.findMatches(filters);
  }

  @Patch('matches/:id/score')
  async updateMatchScore(
    @Param('id') id: string,
    @Body() dto: UpdateMatchScoreDto,
  ) {
    return this.usersService.updateMatchScore(+id, dto);
  }

  @Post('tournament/:category/generate-bracket')
  async generateBracket(@Param('category') category: string) {
    try {
      return await this.usersService.checkAndGenerateBracket(category);
    } catch (error) {
      console.error('Error generating bracket:', error);
      throw new BadRequestException('Failed to generate bracket');
    }
  }
}
