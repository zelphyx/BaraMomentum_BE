import { SetMetadata } from '@nestjs/common';

export const UNIT_SCOPE_KEY = 'rbac.unit_scope';
export const UnitScope = (bodyField: string) => SetMetadata(UNIT_SCOPE_KEY, bodyField);