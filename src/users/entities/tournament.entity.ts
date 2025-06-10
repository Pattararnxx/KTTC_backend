import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Match } from './match.entity';

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ default: 'ongoing' })
  status: string; // ongoing, completed

  @Column({ type: 'text', nullable: true })
  qualification_rules: string;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date;

  @OneToMany(() => Match, (match) => match.tournament)
  matches: Match[];
}
