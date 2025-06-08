import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  firstname: string;

  @Column()
  lastname: string;

  @Column({ nullable: true })
  affiliation: string;

  @Column({ type: 'int', nullable: true })
  seed_rank: number | null;

  @Column()
  category: string;

  @Column()
  slip_filename: string;

  @Column({ default: false })
  is_paid: boolean;

  @Column({ nullable: true })
  group_name: string;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
