import { Global, Module } from '@nestjs/common';

/** Injectable delay so tests can skip real waiting (login penalty, CPNU pacing). */
export type Sleep = (ms: number) => Promise<void>;

export const SLEEP = Symbol('SLEEP');

export const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

@Global()
@Module({
  providers: [{ provide: SLEEP, useValue: realSleep }],
  exports: [SLEEP],
})
export class TimeModule {}
