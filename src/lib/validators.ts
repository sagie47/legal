import { z } from 'zod';

// Identity Schema
export const IdentitySchema = z.object({
  familyName: z.string().min(1, "Family name is required"),
  givenNames: z.string().min(1, "Given names are required"),
  dob: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date of birth",
  }),
  sex: z.string().optional(),
  maritalStatus: z.string().optional(),
}).passthrough(); // Allow extra fields if schema evolves

// Passport Schema
export const PassportSchema = z.object({
  number: z.string().min(1, "Passport number is required"),
  country: z.string().min(1, "Country is required"),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
}).passthrough();

// Education Schema - MVP single object
export const EducationSchema = z.record(z.any()).optional();

// Employment Schema - MVP single object (Legacy)
export const EmploymentSchema = z.record(z.any()).optional();

// Family Schema
export const ApplicantFamilySchema = z.object({
  parents: z.array(z.object({
    relationship: z.enum(['mother', 'father']),
    familyName: z.string(),
    givenNames: z.string(),
    dob: z.string(),
    countryOfBirth: z.string().optional(),
    occupation: z.string().optional(),
  })).optional(),
  children: z.array(z.object({
    familyName: z.string(),
    givenNames: z.string(),
    dob: z.string(),
    relationship: z.enum(['son', 'daughter']),
    doesAccompany: z.boolean().optional(),
    maritalStatus: z.string().optional(),
    currentLocation: z.string().optional(),
  })).optional(),
  spouse: z.any().optional(),
});

// History Schema
export const ApplicantHistorySchema = z.object({
  activities: z.array(z.object({
    type: z.enum(['employed', 'self_employed', 'education', 'unemployed', 'homemaker', 'other']),
    fromDate: z.string(),
    toDate: z.string().optional(),
    jobTitle: z.string().optional(),
    organizationName: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    description: z.string().optional(),
  })),
});

// Meta Schema
export const ApplicantMetaSchema = z.object({
  serviceLanguage: z.enum(['en', 'fr']).optional(),
  phoneCountryGroup: z.string().optional(),
  isUsPermanentResident: z.boolean().optional(),
  usPrCardNumber: z.string().optional(),
  usPrExpiryDate: z.string().optional(),
});

// Main Applicant Data Schema
export const CreateApplicantSchema = z.object({
  identity: IdentitySchema,
  passport: PassportSchema,
  education: EducationSchema,
  employment: EmploymentSchema,
  family: ApplicantFamilySchema.optional(),
  history: ApplicantHistorySchema.optional(),
  meta: ApplicantMetaSchema.optional(),
});

export const UpdateApplicantSchema = CreateApplicantSchema.partial();

// Export Types
export type ApplicantIdentity = z.infer<typeof IdentitySchema>;
export type ApplicantPassport = z.infer<typeof PassportSchema>;
export type ApplicantFamily = z.infer<typeof ApplicantFamilySchema>;
export type ApplicantHistory = z.infer<typeof ApplicantHistorySchema>;
export type ApplicantMeta = z.infer<typeof ApplicantMetaSchema>;
export type CreateApplicantData = z.infer<typeof CreateApplicantSchema>;
export type UpdateApplicantData = z.infer<typeof UpdateApplicantSchema>;
