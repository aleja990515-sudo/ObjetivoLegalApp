import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'auth:isPublic';

/** Marks a controller or route as reachable without a session. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
