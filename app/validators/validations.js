import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  ApplicationStatus,
  DocumentStatus,
  UserType,
  DeskStatus,
} from "../utilities/constant.js";

// Generic validation functions for reusability

const asyncFieldNotExists = async (model, field, value) => {
  if (!model || !value) {
    return false;
  }
  const exists = await prisma[model].findFirst({ where: { [field]: value } });
  return !exists;
};

const asyncFieldNotExistsForUpdate = async (model, field, value, excludeId) => {
  if (!model || !value || !excludeId) {
    return false;
  }
  const exists = await prisma[model].findFirst({
    where: {
      [field]: value,
      id: { not: excludeId },
    },
  });
  return !exists;
};

const asyncEntityExists = async (model, id) => {
  if (!model || !id) {
    return false;
  }
  const entity = await prisma[model].findFirst({ where: { id } });
  return !!entity;
};

const asyncEntitiesExist = async (model, ids) => {
  if (!model || !ids || ids.length === 0) {
    return true; // Optional field
  }
  const entities = await prisma[model].findMany({
    where: { id: { in: ids } },
  });
  return entities.length === ids.length;
};

// Specific validation helpers (using generic functions)
const asyncNumberValidation = async (number) => {
  return !isNaN(Number(number));
};

const asyncEmailNotExists = (email, model) =>
  asyncFieldNotExists(model, "email", email);

const asyncEmailNotExistsForUpdate = (email, model, excludeId) =>
  asyncFieldNotExistsForUpdate(model, "email", email, excludeId);

const asyncStaffExists = (staffId) => asyncEntityExists("adminUser", staffId);

const asyncRoleNameNotExists = (name) =>
  asyncFieldNotExists("role", "name", name);

const asyncRoleNameNotExistsForUpdate = (name, excludeId) =>
  asyncFieldNotExistsForUpdate("role", "name", name, excludeId);

const asyncDocumentCategoryNameNotExists = (name) =>
  asyncFieldNotExists("documentCategory", "name", name);

const asyncDocumentCategoryNameNotExistsForUpdate = (name, excludeId) =>
  asyncFieldNotExistsForUpdate("documentCategory", "name", name, excludeId);

const asyncDocumentTypeNameNotExists = (name) =>
  asyncFieldNotExists("documentType", "name", name);

const asyncDocumentTypeNameNotExistsForUpdate = (name, excludeId) =>
  asyncFieldNotExistsForUpdate("documentType", "name", name, excludeId);

const asyncCategoriesExist = (categoryIds) =>
  asyncEntitiesExist("documentCategory", categoryIds);

// Schemas
const schemas = {
  userLogin: z
    .object({
      email: z.email("Invalid email"),
      password: z
        .string("Password is required")
        .min(6, "Password must be at least 6 characters"),
    })
    .strict(),

  userRegister: z
    .object({
      first_name: z
        .string("First name is required")
        .min(3, "Minimum 3 characters"),
      last_name: z
        .string("Last name is required")
        .min(3, "Minimum 3 characters"),
      email: z
        .email("Invalid email")
        .refine((email) => asyncEmailNotExists(email, "user"), {
          message: "Email already in use",
        }),
      password: z
        .string("Password is required")
        .min(6, "Password must be at least 6 characters"),
      passport_number: z.string().optional(),
    })
    .strict(),

  verifyOtp: z.object({
    email: z.email("Invalid email"),
    otp: z.string("OTP is required").min(1, "OTP is required"),
    type: z.string("Type is required").min(1, "Type is required"),
  }),

  forgotPassword: z.object({
    email: z.email("Invalid email"),
  }),

  resetPassword: z.object({
    email: z.email("Invalid email"),
    otp: z.string("OTP is required").min(1, "OTP is required"),
    password: z
      .string("Password is required")
      .min(6, "Password must be at least 6 characters"),
  }),

  resendOtp: z.object({
    email: z.email("Invalid email"),
    type: z.string("Type is required").min(1, "Type is required"),
  }),

  updateUserProfile: z
    .object({
      first_name: z
        .string("First name is required")
        .min(3, "Minimum 3 characters"),
      last_name: z
        .string("Last name is required")
        .min(3, "Minimum 3 characters"),
      dob: z.coerce.date().optional(),
      passport_number: z.string().optional(),
      phone_number: z.string().optional(),
      avatar: z.any().optional(),
    })
    .strict(),

  changePassword: ({ isOldPasswordRequired = false }) =>
    z.object({
      old_password: isOldPasswordRequired
        ? z.string().min(6, "Password must be at least 6 characters")
        : z.string().optional(),
      new_password: z
        .string("New password is required")
        .min(6, "Password must be at least 6 characters"),
    }),

  testFileUploadApiValidation: z.object({
    name: z.string("Name is required").min(3, "Minimum 3 characters"),
    tags: z
      .any()
      .refine((val) => val !== undefined && val !== null, {
        message: "Tags is required",
      })
      .transform((val) => {
        if (typeof val === "string") {
          return val
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
        }
        return val;
      })
      .pipe(
        z
          .array(z.string().min(1, "Tag cannot be empty"))
          .min(1, "At least one tag is required")
          .max(10, "Maximum 10 tags allowed")
      ),
    number: z
      .string("Number is required")
      .min(1, "Number is required")
      .refine(asyncNumberValidation, {
        message: "Number must be a valid number",
      }),
  }),

  createApplication: z
    .object({
      document_category_id: z
        .number("Document category ID is required")
        .int("Document category ID must be an integer")
        .positive("Document category ID must be a positive integer"),
      application_people_count: z
        .number()
        .int("Application people count must be an integer")
        .min(0, "Application people count cannot be negative")
        .max(10, "Application people count cannot be more than 10"),
      metadata: z.any().optional(),
    })
    .strict(),

  updateApplication: z
    .object({
      metadata: z.any().optional(),
      status: z.enum([ApplicationStatus.SUBMITTED]).optional(),
      document_category_id: z
        .number("Document category ID is required")
        .int("Document category ID must be an integer")
        .positive("Document category ID must be a positive integer")
        .optional(),
    })
    .strict(),
  updateApplicationPerson: z
    .object({
      application_id: z
        .number("Application ID is required")
        .int("Application ID must be an integer")
        .positive("Application ID must be a positive integer"),
      application_people: z
        .array(
          z.object({
            application_person_id: z
              .number("Applicant Person ID is required")
              .int("Applicant Person ID must be an integer")
              .positive("Applicant Person ID must be a positive integer"),
            first_name: z
              .string("First name is required")
              .min(1, "First name is required"),
            last_name: z
              .string("Last name is required")
              .min(1, "Last name is required"),
            role: z
              .string("Role is required")
              .min(1, "Role is required")
              .optional(),
            dob: z.coerce.date().optional(),
            phone_number: z.string().optional(),
            email: z.email("Invalid email format").optional(),
            passport_number: z.string().optional(),
          })
        )
        .min(1, "At least one person is required")
        .max(50, "Cannot update more than 50 people at once"),
    })
    .strict(),

  uploadApplicantDocument: (request) => {
    const userId = request?.auth_id;
    const file = request?.upload?.files?.document;

    return z
      .object({
        application_person_id: z.coerce
          .number({ message: "Applicant Person ID is required" })
          .int("Applicant Person ID must be an integer")
          .positive("Applicant Person ID must be a positive integer"),
        application_id: z.coerce
          .number({ message: "Application ID is required" })
          .int("Application ID must be an integer")
          .positive("Application ID must be a positive integer"),
        document_type_id: z.coerce
          .number({ message: "Document Type ID is required" })
          .int("Document Type ID must be an integer")
          .positive("Document Type ID must be a positive integer")
          .refine(async (id) => asyncEntityExists("documentType", id), {
            message: "Document Type Not Found",
          }),
        document_id: z.coerce
          .number({ message: "Document ID must be a number" })
          .int("Document ID must be an integer")
          .positive("Document ID must be a positive integer")
          .optional(),
      })
      .strict()
      .refine(
        async (data) => {
          const application = await prisma.application.findUnique({
            where: {
              id: data.application_id,
              user_id: userId,
            },
          });
          return !!application;
        },
        {
          message: "Application Not Found",
          path: ["application_id"],
        }
      )
      .refine(
        async (data) => {
          const person = await prisma.applicationPerson.findUnique({
            where: {
              id: data.application_person_id,
              application_id: data.application_id,
              application: { user_id: userId },
            },
          });
          return !!person;
        },
        {
          message: "Application Person Not Found",
          path: ["application_person_id"],
        }
      )
      .refine(
        async (data) => {
          if (!data.document_id) return true;

          const document = await prisma.document.findFirst({
            where: {
              id: data.document_id,
              application_person_id: data.application_person_id,
            },
          });
          return !!document;
        },
        {
          message: "Document Not Found",
          path: ["document_id"],
        }
      )
      .refine(
        async (data) => {
          // Only check for duplicates when creating (not updating)
          if (data.document_id) return true;

          const existingDocument = await prisma.document.findFirst({
            where: {
              application_person_id: data.application_person_id,
              document_type_id: data.document_type_id,
            },
          });
          return !existingDocument;
        },
        {
          message: "Document of this type already exists for this person",
          path: ["document_type_id"],
        }
      )
      .refine(() => file, {
        message: "Document file is required",
        path: ["document"],
      });
  },
};

const adminSchemas = {
  officeHours: z
    .object({
      start_time: z
        .string({ required_error: "Start time is required" })
        .regex(
          /^(0[1-9]|1[0-2]):[0-5][0-9] ?([AaPp][Mm])$/,
          "Start time must be in hh:mm AM/PM format (e.g., 09:00 AM)"
        ),
      end_time: z
        .string({ required_error: "End time is required" })
        .regex(
          /^(0[1-9]|1[0-2]):[0-5][0-9] ?([AaPp][Mm])$/,
          "End time must be in hh:mm AM/PM format (e.g., 05:00 PM)"
        ),
      appointment_duration: z
        .number({ required_error: "Appointment duration is required" })
        .int("Appointment duration must be an integer")
        .positive("Appointment duration must be positive"),
      weekend_days: z
        .array(z.number().int().min(0).max(6), {
          invalid_type_error:
            "Weekend days must be an array of numbers between 0 and 6",
        })
        .optional(),
    })
    .refine(
      (data) => {
        // Parse times to 24-hour for logical comparison
        const parseTime = (timeStr) => {
          const match = timeStr.match(/^(\d{2}):(\d{2}) ?([AaPp][Mm])$/);
          if (!match) return null;

          const [, hour, minute, period] = match;
          let h = parseInt(hour, 10);
          const m = parseInt(minute, 10);

          if (period.toUpperCase() === "PM" && h !== 12) h += 12;
          if (period.toUpperCase() === "AM" && h === 12) h = 0;

          return h * 60 + m; // Convert to minutes for easy comparison
        };

        const startMinutes = parseTime(data.start_time);
        const endMinutes = parseTime(data.end_time);

        if (startMinutes === null || endMinutes === null) return false;

        return endMinutes > startMinutes;
      },
      {
        message: "End time must be after start time",
        path: ["end_time"],
      }
    )
    .strict(),
  adminUserLogin: z.object({
    email: z.email("Invalid email"),
    password: z
      .string("Password is required")
      .min(6, "Password must be at least 6 characters"),
  }),

  createDocumentType: z
    .object({
      name: z
        .string("Document type name is required")
        .min(2, "Document type name must be at least 2 characters")
        .max(100, "Document type name must not exceed 100 characters")
        .refine((name) => asyncDocumentTypeNameNotExists(name), {
          message: "Document type name already exists",
        }),
      description: z.string().optional(),
      is_required: z.boolean("is_required must be a boolean").default(true),
    })
    .strict(),

  updateDocumentType: ({ documentTypeId }) =>
    z
      .object({
        name: z
          .string("Document type name is required")
          .min(2, "Document type name must be at least 2 characters")
          .max(100, "Document type name must not exceed 100 characters")
          .refine(
            (name) =>
              asyncDocumentTypeNameNotExistsForUpdate(name, documentTypeId),
            {
              message:
                "Document type name already exists. Please use a different name.",
            }
          )
          .optional(),
        description: z.string().optional(),
        is_required: z.boolean("is_required must be a boolean").optional(),
      })
      .strict(),

  adminUserUpdateProfile: z
    .object({
      first_name: z
        .string("First name is required")
        .min(3, "Minimum 3 characters"),
      last_name: z
        .string("Last name is required")
        .min(3, "Minimum 3 characters"),
      dob: z.coerce.date().optional(),
      avatar: z.any().optional(),
    })
    .strict(),

  createStaff: z
    .object({
      first_name: z
        .string("First name is required")
        .min(3, "Minimum 3 characters"),
      last_name: z.string().optional(),
      email: z
        .email("Invalid email")
        .refine((email) => asyncEmailNotExists(email, "adminUser"), {
          message: "Email already in use",
        }),
      password: z
        .string("Password is required")
        .min(6, "Password must be at least 6 characters"),
      dob: z.coerce.date().optional(),
      user_type: z
        .string("User type is required")
        .refine((val) => val === UserType.ADMIN || val === UserType.STAFF, {
          message: "User type must be ADMIN or STAFF",
        }),
      document_categories: z
        .array(z.number().int().positive())
        .optional()
        .refine((ids) => asyncCategoriesExist(ids), {
          message: "One or more category IDs do not exist",
        }),
    })
    .strict(),
  updateStaff: ({ staffId }) =>
    z
      .object({
        first_name: z
          .string("First name is required")
          .min(3, "Minimum 3 characters")
          .optional(),
        last_name: z.string().optional(),
        email: z
          .email("Invalid email")
          .refine(
            (email) =>
              asyncEmailNotExistsForUpdate(email, "adminUser", staffId),
            {
              message: "Email already exists. Please use a different email.",
            }
          )
          .optional(),
        dob: z.coerce.date().optional(),
        user_type: z
          .string("User type is required")
          .refine((val) => val === UserType.ADMIN || val === UserType.STAFF, {
            message: "User type must be ADMIN or STAFF",
          })
          .optional(),
        document_categories: z
          .array(z.number().int().positive())
          .refine((ids) => asyncCategoriesExist(ids), {
            message: "One or more category IDs do not exist",
          })
          .optional(),
      })
      .refine(() => asyncStaffExists(staffId), {
        message: "User not found",
        path: ["id"],
      })
      .strict(),
  updateStaffStatus: z.object({
    is_active: z.boolean("Status must be a boolean"),
  }),

  createRole: z
    .object({
      name: z
        .string("Role name is required")
        .min(2, "Role name must be at least 2 characters")
        .max(100, "Role name must not exceed 100 characters")
        .refine((name) => asyncRoleNameNotExists(name), {
          message: "Role name already exists",
        }),
      is_admin: z
        .boolean("is_admin must be a boolean")
        .optional()
        .default(false),
      permissions: z
        .array(
          z
            .object({
              module: z.string("Module name is required"),
              permission: z.array(
                z
                  .object({
                    module: z.string("Module name is required"),
                    operation: z.string("Operation name is required"),
                    is_permit: z.boolean("is_permit must be a boolean"),
                  })
                  .strict()
              ),
            })
            .strict()
        )
        .optional(),
    })
    .strict(),

  updateRole: ({ roleId }) =>
    z
      .object({
        name: z
          .string("Role name is required")
          .min(2, "Role name must be at least 2 characters")
          .max(100, "Role name must not exceed 100 characters")
          .refine((name) => asyncRoleNameNotExistsForUpdate(name, roleId), {
            message: "Role name already exists. Please use a different name.",
          })
          .optional(),
        is_admin: z.boolean("is_admin must be a boolean").optional(),
        permissions: z
          .array(
            z
              .object({
                module: z.string("Module name is required"),
                permission: z.array(
                  z
                    .object({
                      module: z.string("Module name is required"),
                      operation: z.string("Operation name is required"),
                      is_permit: z.boolean("is_permit must be a boolean"),
                    })
                    .strict()
                ),
              })
              .strict()
          )
          .optional(),
      })
      .strict(),

  createDocumentCategory: z
    .object({
      name: z
        .string("Category name is required")
        .min(2, "Category name must be at least 2 characters")
        .max(100, "Category name must not exceed 100 characters")
        .refine((name) => asyncDocumentCategoryNameNotExists(name), {
          message: "Category name already exists",
        }),
      description: z.string().optional(),
      document_type_ids: z
        .array(z.coerce.number().int().positive())
        .min(1, "At least one document type is required"),
      is_active: z
        .boolean("is_active must be a boolean")
        .optional()
        .default(true),
    })
    .strict(),

  updateDocumentCategory: ({ categoryId }) =>
    z
      .object({
        name: z
          .string("Category name is required")
          .min(2, "Category name must be at least 2 characters")
          .max(100, "Category name must not exceed 100 characters")
          .refine(
            (name) =>
              asyncDocumentCategoryNameNotExistsForUpdate(name, categoryId),
            {
              message:
                "Category name already exists. Please use a different name.",
            }
          )
          .optional(),
        description: z.string().optional(),
        document_type_ids: z
          .array(z.coerce.number().int().positive())
          .min(1, "At least one document type is required")
          .optional(),
        is_active: z.boolean("is_active must be a boolean").optional(),
      })
      .strict(),

  documentReview: z
    .object({
      application_person_id: z.coerce
        .number({ message: "Applicant Person ID is required" })
        .int("Applicant Person ID must be an integer")
        .positive("Applicant Person ID must be a positive integer"),
      application_id: z.coerce
        .number({ message: "Application ID is required" })
        .int("Application ID must be an integer")
        .positive("Application ID must be a positive integer"),

      document_id: z.coerce
        .number({ message: "Document ID must be a number" })
        .int("Document ID must be an integer")
        .positive("Document ID must be a positive integer"),
      comment: z
        .string("Comment is required")
        .max(1000, "Comment must not exceed 1000 characters"),
    })
    .strict(),
  documentStatus: z
    .object({
      application_person_id: z.coerce
        .number({ message: "Applicant Person ID is required" })
        .int("Applicant Person ID must be an integer")
        .positive("Applicant Person ID must be a positive integer"),
      application_id: z.coerce
        .number({ message: "Application ID is required" })
        .int("Application ID must be an integer")
        .positive("Application ID must be a positive integer"),

      document_id: z.coerce
        .number({ message: "Document ID must be a number" })
        .int("Document ID must be an integer")
        .positive("Document ID must be a positive integer"),
      status: z.enum(
        Object.values(DocumentStatus).filter(
          (s) => s !== DocumentStatus.PENDING
        ),
        {
          errorMap: () => ({
            message: "Status must be  APPROVED, or REJECTED",
          }),
        }
      ),
    })
    .strict(),

  createDesk: z
    .object({
      name: z
        .string()
        .min(1, "Desk name is required")
        .max(100, "Desk name must be less than 100 characters"),
      is_active: z.boolean().optional(),
    })
    .strict(),

  updateDesk: z
    .object({
      name: z
        .string()
        .min(1, "Desk name is required")
        .max(100, "Desk name must be less than 100 characters")
        .optional(),
      is_active: z.boolean().optional(),
    })
    .strict(),

  updateDeskStatus: z
    .object({
      status: z.enum(Object.values(DeskStatus), {
        required_error: "Status is required",
        invalid_type_error: "Status must be AVAILABLE, BUSY, or BREAK",
      }),
    })
    .strict(),
};

export { adminSchemas, schemas };
