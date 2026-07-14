import { z } from 'zod';

const optionalTrimmed = (max: number) => z.string().trim().max(max).nullable().optional().transform((value) => value === '' ? null : value);

export const updateProfileSchema = z.object({
  version: z.number().int().positive(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phoneCountryCode: optionalTrimmed(8),
  phoneNumber: optionalTrimmed(32),
  addressLine: optionalTrimmed(200),
  city: optionalTrimmed(100),
  state: optionalTrimmed(100),
  postalCode: optionalTrimmed(20),
}).strict();
