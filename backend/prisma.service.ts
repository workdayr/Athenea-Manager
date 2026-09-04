import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export class PrismaService extends PrismaClient {
  constructor() {
    super({ adapter });
  }
}