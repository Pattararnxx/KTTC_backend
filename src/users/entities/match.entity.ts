import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Tournament } from './tournament.entity';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tournament)
  @JoinColumn({ name: 'tournament_id' })
  tournament: Tournament;

  @Column()
  tournament_id: number;

  @Column()
  round: string; // group, round32, round16, quarter, semi, final

  @Column({ nullable: true })
  group_name: string; // A, B, C, D

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'player1_id' })
  player1: User | null;

  @Column({ nullable: true })
  player1_id: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'player2_id' })
  player2: User | null;

  @Column({ nullable: true })
  player2_id: number | null;

  @Column({ type: 'int', nullable: true })
  player1_score: number | null;

  @Column({ type: 'int', nullable: true })
  player2_score: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'winner_id' })
  winner: User | null;

  @Column({ nullable: true })
  winner_id: number | null;

  @Column({ type: 'int' })
  match_order: number;

  @Column({ default: 'pending' })
  status: string; // pending, completed

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;
}
