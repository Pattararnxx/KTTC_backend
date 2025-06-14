import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    UsersModule,
    DatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AdminModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
