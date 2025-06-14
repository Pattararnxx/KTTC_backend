import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { adminProviders } from './admin.providers';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService, ...adminProviders],
  exports: [AdminService],
})
export class AdminModule {}
