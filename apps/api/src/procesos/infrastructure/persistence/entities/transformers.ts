import type { ValueTransformer } from 'typeorm';

/** `bigint` columns come back from `pg` as strings; CPNU ids fit in a JS number. */
export const bigintToNumber: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
