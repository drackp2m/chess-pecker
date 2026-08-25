import { NamingStrategy, UnderscoreNamingStrategy } from '@mikro-orm/core';

export class MikroOrmNamingStrategy extends UnderscoreNamingStrategy implements NamingStrategy {}
