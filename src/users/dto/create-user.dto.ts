export class CreateUserDto {
  firstname: string;
  lastname: string;
  affiliation?: string;
  seed_rank?: number | string;
  category: string;
}
