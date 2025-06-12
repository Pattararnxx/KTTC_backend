import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Match } from './entities/match.entity';
import { Tournament } from './entities/tournament.entity';
import { UpdateMatchScoreDto } from './dto/update-match-score.dto';

type CreateUserData = Omit<User, 'id' | 'created_at'>;
interface QualificationRules {
  [groupName: string]: number;
}

interface PlayerWithGroupInfo extends User {
  groupName?: string;
  groupRank?: number;
  totalPoints?: number;
}

interface PlayerStats {
  id: number;
  player: User;
  points: number;
  wins: number;
  gamesWon: number;
  gamesLost: number;
}

@Injectable()
export class UsersService {
  constructor(
    @Inject('USERS_REPOSITORY')
    private readonly userRepository: Repository<User>,
    @Inject('TOURNAMENTS_REPOSITORY')
    private readonly tournamentRepository: Repository<Tournament>,
    @Inject('MATCHES_REPOSITORY')
    private readonly matchRepository: Repository<Match>,
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
  async createTournamentWithDraw(): Promise<void> {
    const allPlayers = await this.userRepository.find({
      where: {
        is_paid: true,
        group_name: Not(IsNull()),
      },
      order: { category: 'ASC', group_name: 'ASC', seed_rank: 'ASC' },
    });

    const seedPlayers = await this.userRepository.find({
      where: {
        is_paid: true,
        seed_rank: Not(IsNull()),
      },
      order: { category: 'ASC', seed_rank: 'ASC' },
    });

    const playersByCategory = this.groupPlayersByCategory(allPlayers);
    const seedsByCategory = this.groupPlayersByCategory(seedPlayers);

    for (const category of new Set([
      ...Object.keys(playersByCategory),
      ...Object.keys(seedsByCategory),
    ])) {
      await this.createCategoryTournament(
        category,
        playersByCategory[category] || [],
        seedsByCategory[category] || [],
      );
    }
  }

  private groupPlayersByCategory(players: User[]): Record<string, User[]> {
    const grouped: Record<string, User[]> = {};

    for (const player of players) {
      if (!grouped[player.category]) {
        grouped[player.category] = [];
      }
      grouped[player.category].push(player);
    }

    return grouped;
  }

  private async createCategoryTournament(
    category: string,
    groupPlayers: User[],
    seedPlayers: User[],
  ): Promise<void> {
    const tournament = await this.tournamentRepository.save({
      name: `${category} Tournament 2025`,
      category,
      status: 'ongoing',
    });

    if (groupPlayers.length > 0) {
      await this.createGroupMatches(tournament.id, groupPlayers);
    }

    if (seedPlayers.length > 0 || groupPlayers.length > 0) {
      await this.createKnockoutStructure(
        tournament.id,
        groupPlayers,
        seedPlayers,
      );
    }
  }

  private async createGroupMatches(
    tournamentId: number,
    players: User[],
  ): Promise<void> {
    const groupedPlayers = this.getPlayersWithGroups(players);

    let matchOrder = 1;
    for (const [groupName, groupPlayers] of Object.entries(groupedPlayers)) {
      for (let i = 0; i < groupPlayers.length; i++) {
        for (let j = i + 1; j < groupPlayers.length; j++) {
          await this.matchRepository.save({
            tournament_id: tournamentId,
            round: 'group',
            group_name: groupName,
            player1_id: groupPlayers[i].id,
            player2_id: groupPlayers[j].id,
            match_order: matchOrder++,
            status: 'pending',
          });
        }
      }
    }
  }

  private getPlayersWithGroups(players: User[]): Record<string, User[]> {
    const grouped: Record<string, User[]> = {};

    for (const player of players) {
      if (player.group_name) {
        if (!grouped[player.group_name]) {
          grouped[player.group_name] = [];
        }
        grouped[player.group_name].push(player);
      }
    }

    return grouped;
  }

  private async createKnockoutStructure(
    tournamentId: number,
    groupPlayers: User[],
    seedPlayers: User[],
  ): Promise<void> {
    const BRACKET_SIZE = 16;
    const numSeeds = seedPlayers.length;

    const groupsByName = this.getPlayersWithGroups(groupPlayers);
    const numGroups = Object.keys(groupsByName).length;
    const qualifiersNeeded = BRACKET_SIZE - numSeeds;

    if (qualifiersNeeded > 0 && numGroups > 0) {
      const qualifiersPerGroup = this.calculateQualifiersPerGroup(
        groupsByName,
        qualifiersNeeded,
      );

      await this.tournamentRepository.update(tournamentId, {
        qualification_rules: JSON.stringify(qualifiersPerGroup),
      });
    }

    let matchOrder = 1000;

    const seedPositions = this.calculateSeedPositions(
      BRACKET_SIZE,
      seedPlayers,
    );
    for (let i = 0; i < 8; i++) {
      const player1 = seedPositions[i * 2] || null;
      const player2 = seedPositions[i * 2 + 1] || null;

      await this.matchRepository.save({
        tournament_id: tournamentId,
        round: 'round16',
        player1_id: player1?.id || null,
        player2_id: player2?.id || null,
        match_order: matchOrder++,
        status: 'pending',
      });
    }

    const rounds = ['quarter', 'semi', 'final'];
    const matchCounts = [4, 2, 1];

    for (let r = 0; r < rounds.length; r++) {
      for (let i = 0; i < matchCounts[r]; i++) {
        await this.matchRepository.save({
          tournament_id: tournamentId,
          round: rounds[r],
          player1_id: null,
          player2_id: null,
          match_order: matchOrder++,
          status: 'pending',
        });
      }
    }
  }

  private calculateQualifiersPerGroup(
    groupsByName: Record<string, User[]>,
    totalQualifiersNeeded: number,
  ): Record<string, number> {
    const qualifiersPerGroup: Record<string, number> = {};
    const groupNames = Object.keys(groupsByName);
    const numGroups = groupNames.length;

    if (numGroups === 0) return {};

    const baseQualifiers = Math.floor(totalQualifiersNeeded / numGroups);
    const extraQualifiers = totalQualifiersNeeded % numGroups;

    for (let i = 0; i < numGroups; i++) {
      const groupName = groupNames[i];
      const groupSize = groupsByName[groupName].length;

      let qualifiers = baseQualifiers + (i < extraQualifiers ? 1 : 0);

      qualifiers = Math.min(qualifiers, groupSize);

      qualifiersPerGroup[groupName] = qualifiers;
    }

    return qualifiersPerGroup;
  }

  private calculateSeedPositions(
    bracketSize: number,
    seeds: User[],
  ): (User | null)[] {
    const positions: (User | null)[] = Array(bracketSize).fill(
      null,
    ) as (User | null)[];

    if (seeds.length === 0) return positions;

    const seedPositions = [
      0, 15, 7, 8, 3, 12, 4, 11, 1, 14, 6, 9, 2, 13, 5, 10,
    ];

    for (let i = 0; i < seeds.length && i < seedPositions.length; i++) {
      positions[seedPositions[i]] = seeds[i];
    }

    return positions;
  }
  async findMatches(filters: {
    category?: string;
    groupName?: string;
    round?: string;
    rounds?: string[];
  }): Promise<Match[]> {
    const qb = this.matchRepository
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.tournament', 'tournament')
      .leftJoinAndSelect('match.player1', 'player1')
      .leftJoinAndSelect('match.player2', 'player2');

    if (filters.category) {
      qb.andWhere('tournament.category = :category', {
        category: filters.category,
      });
    }
    if (filters.round === 'group' && filters.groupName) {
      qb.andWhere('match.group_name = :groupName', {
        groupName: filters.groupName,
      });
    }
    if (filters.rounds) {
      qb.andWhere('match.round IN (:...rounds)', { rounds: filters.rounds });
    } else if (filters.round) {
      qb.andWhere('match.round = :round', { round: filters.round });
    }

    qb.orderBy('match.match_order', 'ASC');

    return await qb.getMany();
  }

  async updateMatchScore(matchId: number, dto: UpdateMatchScoreDto) {
    const match = await this.matchRepository.findOne({
      where: { id: matchId },
    });
    if (!match) throw new Error('Match not found');

    match.player1_score = dto.player1_score;
    match.player2_score = dto.player2_score;

    if (dto.winner_id !== undefined) {
      match.winner_id = dto.winner_id;
    } else {
      if (dto.player1_score > dto.player2_score) {
        match.winner_id = match.player1_id;
      } else if (dto.player2_score > dto.player1_score) {
        match.winner_id = match.player2_id;
      } else {
        match.winner_id = null;
      }
    }

    match.status = dto.status || 'completed';

    await this.matchRepository.save(match);
    return match;
  }

  async checkAndGenerateBracket(
    category: string,
  ): Promise<{ message: string; generated: boolean }> {
    const tournament = await this.tournamentRepository.findOne({
      where: { category },
    });

    if (!tournament) {
      return { message: 'Tournament not found', generated: false };
    }

    const groupMatches = await this.matchRepository.find({
      where: {
        tournament_id: tournament.id,
        round: 'group',
      },
    });

    const completedGroupMatches = groupMatches.filter(
      (m) => m.status === 'completed',
    );

    if (completedGroupMatches.length !== groupMatches.length) {
      return { message: 'Group stage not completed yet', generated: false };
    }

    const bracketMatches = await this.matchRepository.find({
      where: {
        tournament_id: tournament.id,
        round: 'round16',
      },
    });

    const bracketWithPlayers = bracketMatches.filter(
      (m) => m.player1_id && m.player2_id,
    );
    if (bracketWithPlayers.length > 0) {
      return { message: 'Bracket already generated', generated: false };
    }

    await this.generateBracketFromGroupResults(tournament.id, category);

    return { message: 'Bracket generated successfully', generated: true };
  }

  private async generateBracketFromGroupResults(
    tournamentId: number,
    category: string,
  ): Promise<void> {
    const groupResults = await this.calculateGroupStandings(tournamentId);

    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
    });

    let qualificationRules: QualificationRules = {};
    if (tournament?.qualification_rules) {
      try {
        const parsed = JSON.parse(tournament.qualification_rules) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          qualificationRules = parsed as QualificationRules;
        }
      } catch (error) {
        console.error('Error parsing qualification rules:', error);
        qualificationRules = {};
      }
    }

    const qualifiedPlayers = this.selectQualifiedPlayers(
      groupResults,
      qualificationRules,
    );

    const seedPlayers = await this.userRepository.find({
      where: {
        category,
        seed_rank: Not(IsNull()),
      },
      order: { seed_rank: 'ASC' },
    });

    const bracketPairs = this.createBracketPairings([
      ...seedPlayers,
      ...qualifiedPlayers,
    ]);

    await this.updateBracketMatches(tournamentId, bracketPairs);
  }

  private async calculateGroupStandings(
    tournamentId: number,
  ): Promise<Record<string, PlayerStats[]>> {
    const groupMatches = await this.matchRepository.find({
      where: {
        tournament_id: tournamentId,
        round: 'group',
        status: 'completed',
      },
      relations: ['player1', 'player2'],
    });

    const groupStandings: Record<string, Map<number, PlayerStats>> = {};

    groupMatches.forEach((match) => {
      if (!match.group_name || !match.player1_id || !match.player2_id) return;

      if (!groupStandings[match.group_name]) {
        groupStandings[match.group_name] = new Map<number, PlayerStats>();
      }

      const standings = groupStandings[match.group_name];

      if (!standings.has(match.player1_id)) {
        standings.set(match.player1_id, {
          id: match.player1_id,
          player: match.player1!,
          points: 0,
          wins: 0,
          gamesWon: 0,
          gamesLost: 0,
        });
      }

      if (!standings.has(match.player2_id)) {
        standings.set(match.player2_id, {
          id: match.player2_id,
          player: match.player2!,
          points: 0,
          wins: 0,
          gamesWon: 0,
          gamesLost: 0,
        });
      }

      const player1Stats = standings.get(match.player1_id);
      const player2Stats = standings.get(match.player2_id);

      if (!player1Stats || !player2Stats) return;

      player1Stats.gamesWon += match.player1_score || 0;
      player1Stats.gamesLost += match.player2_score || 0;
      player2Stats.gamesWon += match.player2_score || 0;
      player2Stats.gamesLost += match.player1_score || 0;

      if (match.winner_id === match.player1_id) {
        player1Stats.wins++;
        player1Stats.points += 2;
        if (match.player2_score && match.player2_score > 0) {
          player2Stats.points += 1;
        }
      } else if (match.winner_id === match.player2_id) {
        player2Stats.wins++;
        player2Stats.points += 2;
        if (match.player1_score && match.player1_score > 0) {
          player1Stats.points += 1;
        }
      }
    });

    const sortedGroupStandings: Record<string, PlayerStats[]> = {};

    Object.entries(groupStandings).forEach(([groupName, standings]) => {
      sortedGroupStandings[groupName] = Array.from(standings.values()).sort(
        (a, b) => {
          if (a.points !== b.points) return b.points - a.points;
          if (a.wins !== b.wins) return b.wins - a.wins;
          const aRatio =
            a.gamesLost === 0 ? a.gamesWon : a.gamesWon / a.gamesLost;
          const bRatio =
            b.gamesLost === 0 ? b.gamesWon : b.gamesWon / b.gamesLost;
          return bRatio - aRatio;
        },
      );
    });

    return sortedGroupStandings;
  }

  private selectQualifiedPlayers(
    groupStandings: Record<string, PlayerStats[]>,
    qualificationRules: QualificationRules,
  ): PlayerWithGroupInfo[] {
    const qualified: PlayerWithGroupInfo[] = [];

    Object.entries(groupStandings).forEach(([groupName, standings]) => {
      const qualifyCount = qualificationRules[groupName] || 2;
      const groupQualified = standings.slice(0, qualifyCount);

      groupQualified.forEach((playerStats, index) => {
        const playerWithGroupInfo: PlayerWithGroupInfo = {
          ...playerStats.player,
          groupName,
          groupRank: index + 1,
          totalPoints: playerStats.points,
        };
        qualified.push(playerWithGroupInfo);
      });
    });

    return qualified;
  }

  private createBracketPairings(
    allPlayers: (User | PlayerWithGroupInfo)[],
  ): { player1: User; player2: User }[] {
    const pairs: { player1: User; player2: User }[] = [];

    const seedPlayers = allPlayers
      .filter((p) => p.seed_rank)
      .sort((a, b) => (a.seed_rank || 0) - (b.seed_rank || 0));
    const groupPlayers = allPlayers.filter(
      (p) => !p.seed_rank,
    ) as PlayerWithGroupInfo[];

    groupPlayers.sort((a, b) => {
      if ((a.totalPoints || 0) !== (b.totalPoints || 0)) {
        return (b.totalPoints || 0) - (a.totalPoints || 0);
      }
      return (a.groupRank || 0) - (b.groupRank || 0);
    });

    const combinedPlayers = [...seedPlayers, ...groupPlayers];
    console.log('Combined players for pairing:', combinedPlayers.length);

    const usedPlayers = new Set<number>();

    combinedPlayers.forEach((player1) => {
      if (usedPlayers.has(player1.id)) return;

      const opponent = combinedPlayers.find(
        (player2) =>
          !usedPlayers.has(player2.id) &&
          player2.id !== player1.id &&
          player1.affiliation !== player2.affiliation &&
          this.getPlayerGroupName(player1) !== this.getPlayerGroupName(player2),
      );

      if (opponent) {
        pairs.push({ player1, player2: opponent });
        usedPlayers.add(player1.id);
        usedPlayers.add(opponent.id);
      }
    });

    console.log('Pairs after strict matching:', pairs.length);
    combinedPlayers.forEach((player1) => {
      if (usedPlayers.has(player1.id)) return;

      const opponent = combinedPlayers.find(
        (player2) =>
          !usedPlayers.has(player2.id) &&
          player2.id !== player1.id &&
          player1.affiliation !== player2.affiliation,
      );

      if (opponent) {
        pairs.push({ player1, player2: opponent });
        usedPlayers.add(player1.id);
        usedPlayers.add(opponent.id);
      }
    });
    console.log('Pairs after relaxed matching:', pairs.length);

    combinedPlayers.forEach((player1) => {
      if (usedPlayers.has(player1.id)) return;

      const opponent = combinedPlayers.find(
        (player2) => !usedPlayers.has(player2.id) && player2.id !== player1.id,
      );

      if (opponent) {
        pairs.push({ player1, player2: opponent });
        usedPlayers.add(player1.id);
        usedPlayers.add(opponent.id);
      }
    });

    console.log('Final pairs:', pairs.length);
    console.log('Unused players:', combinedPlayers.length - usedPlayers.size);

    return pairs;
  }

  private async updateBracketMatches(
    tournamentId: number,
    pairs: { player1: User; player2: User }[],
  ): Promise<void> {
    const bracketMatches = await this.matchRepository.find({
      where: {
        tournament_id: tournamentId,
        round: 'round16',
      },
      order: { match_order: 'ASC' },
    });

    console.log('Available bracket slots:', bracketMatches.length);
    console.log('Pairs to assign:', pairs.length);

    for (let i = 0; i < Math.min(pairs.length, bracketMatches.length); i++) {
      const match = bracketMatches[i];
      const pair = pairs[i];

      await this.matchRepository.update(match.id, {
        player1_id: pair.player1.id,
        player2_id: pair.player2.id,
        status: 'pending',
      });
    }
  }
  private getPlayerGroupName(
    player: User | PlayerWithGroupInfo,
  ): string | undefined {
    return (
      (player as PlayerWithGroupInfo).groupName || (player as User).group_name
    );
  }
}
