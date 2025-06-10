import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Tournament } from './entities/tournament.entity';
import { Match } from './entities/match.entity';

export const usersProviders = [
  {
    provide: 'USERS_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(User),
    inject: ['DATA_SOURCE'],
  },
  {
    provide: 'TOURNAMENTS_REPOSITORY',
    useFactory: (dataSource: DataSource) =>
      dataSource.getRepository(Tournament),
    inject: ['DATA_SOURCE'],
  },
  {
    provide: 'MATCHES_REPOSITORY',
    useFactory: (dataSource: DataSource) => dataSource.getRepository(Match),
    inject: ['DATA_SOURCE'],
  },
];
