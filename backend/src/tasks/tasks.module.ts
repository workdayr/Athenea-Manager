import { Module } from '@nestjs/common';
import { TasksResolver } from './tasks.resolver.js';

@Module({
  providers: [TasksResolver],
})
export class TasksModule {}
