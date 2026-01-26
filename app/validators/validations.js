import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  BillingCycle,
  CouponType,
  EventStatus,
  PurchaseType,
  SubscriptionTier,
  UserType,
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

// User Schemas (grouped by feature)
const schemas = {
  auth: {
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
        passport_number: z
          .string("Passport number is required")
          .min(1, "Passport number is required"),
        phone_number: z
          .string("Phone number is required")
          .min(1, "Phone number is required"),
        dob: z.coerce.date("Date of Birth is required"),
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
  },

  profile: {
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
  },

  event: {
    createStallBooking: z
      .object({
        event_id: z.coerce.number().int().positive(),
        stall_category_id: z.coerce.number().int().positive(),
        quantity: z.coerce
          .number()
          .int()
          .positive()
          .min(1, "Quantity must be at least 1"),
        company_name: z.string().optional(),
        contact_person: z.string().min(2, "Contact person is required"),
        contact_email: z.string().email("Invalid email"),
        contact_phone: z.string().min(10, "Phone number is required"),
        special_requests: z.string().optional(),
        billing_info: z
          .object({
            name: z.string(),
            email: z.string().email(),
            address: z.string().optional(),
            city: z.string().optional(),
            country: z.string().optional(),
            zip: z.string().optional(),
          })
          .optional(),
      })
      .strict(),

    createSponsorshipPurchase: z
      .object({
        event_id: z.coerce.number().int().positive(),
        sponsorship_package_id: z.coerce.number().int().positive(),
        company_name: z.string().min(2, "Company name is required"),
        company_website: z.string().url("Invalid website URL").optional(),
        contact_person: z.string().min(2, "Contact person is required"),
        contact_email: z.string().email("Invalid email"),
        contact_phone: z.string().min(10, "Phone number is required"),
        special_requests: z.string().optional(),
        billing_info: z.any().optional(),
      })
      .strict(),
  },

  subscription: {
    createSubscription: z
      .object({
        tier: z.enum(Object.values(SubscriptionTier), {
          required_error: "Subscription tier is required",
          invalid_type_error: "Invalid subscription tier",
        }),
        billing_cycle: z.enum(Object.values(BillingCycle), {
          required_error: "Billing cycle is required",
          invalid_type_error: "Invalid billing cycle",
        }),
        coupon_code: z.string().optional(),
      })
      .strict(),

    validateCoupon: z
      .object({
        code: z.string().min(3, "Coupon code is required"),
      })
      .strict(),
  },

  payment: {
    initiatePayment: z
      .object({
        invoice_id: z.number().int().positive("Invalid invoice ID"),
        payment_method: z.string().min(1, "Payment method is required"),
      })
      .strict(),

    requestRefund: z
      .object({
        reason: z.string().min(5, "Reason must be at least 5 characters"),
        amount: z.number().positive("Amount must be positive").optional(),
      })
      .strict(),
  },
};

// Admin Schemas (grouped by feature)
const adminSchemas = {
  auth: {
    adminUserLogin: z.object({
      email: z.email("Invalid email"),
      password: z
        .string("Password is required")
        .min(6, "Password must be at least 6 characters"),
    }),
  },

  profile: {
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
  },

  staff: {
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
        avatar: z.any().optional(),
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
              },
            )
            .optional(),
          dob: z.coerce.date().optional(),
          user_type: z
            .string("User type is required")
            .refine((val) => val === UserType.ADMIN || val === UserType.STAFF, {
              message: "User type must be ADMIN or STAFF",
            })
            .optional(),
          password: z.string().optional(),
          avatar: z.any().optional(),
        })
        .refine(() => asyncStaffExists(staffId), {
          message: "User not found",
          path: ["id"],
        })
        .strict(),

    updateStaffStatus: z.object({
      is_active: z.boolean("Status must be a boolean"),
    }),
  },

  role: {
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
                    .strict(),
                ),
              })
              .strict(),
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
                      .strict(),
                  ),
                })
                .strict(),
            )
            .optional(),
        })
        .strict(),
  },

  subscription: {
    createSubscription: z
      .object({
        tier: z.enum(Object.values(SubscriptionTier), {
          required_error: "Subscription tier is required",
          invalid_type_error: "Invalid subscription tier",
        }),
        billing_cycle: z.enum(Object.values(BillingCycle), {
          required_error: "Billing cycle is required",
          invalid_type_error: "Invalid billing cycle",
        }),
        coupon_code: z.string().optional(),
      })
      .strict(),

    updateSubscriptionStatus: z
      .object({
        notes: z.string().optional(),
      })
      .strict(),

    createSubscriptionPrice: z
      .object({
        tier: z.enum(Object.values(SubscriptionTier), {
          required_error: "Tier is required",
        }),
        billing_cycle: z.enum(Object.values(BillingCycle), {
          required_error: "Billing cycle is required",
        }),
        price: z.number().positive("Price must be positive"),
        currency: z
          .string()
          .length(3, "Currency must be 3 characters")
          .optional(),
        active: z.boolean().optional(),
        region: z.string().optional(),
        valid_from: z.coerce.date().optional(),
        valid_until: z.coerce.date().optional(),
        discount_pct: z.number().min(0).max(100).optional(),
        promo_code: z.string().optional(),
      })
      .strict(),

    updateSubscriptionPrice: z
      .object({
        price: z.number().positive("Price must be positive").optional(),
        currency: z.string().length(3).optional(),
        active: z.boolean().optional(),
        region: z.string().optional(),
        valid_from: z.coerce.date().optional(),
        valid_until: z.coerce.date().optional(),
        discount_pct: z.number().min(0).max(100).optional(),
        promo_code: z.string().optional(),
      })
      .strict(),
  },

  payment: {
    initiatePayment: z
      .object({
        invoice_id: z.number().int().positive("Invalid invoice ID"),
        payment_method: z.string().min(1, "Payment method is required"),
      })
      .strict(),

    requestRefund: z
      .object({
        reason: z.string().min(5, "Reason must be at least 5 characters"),
        amount: z.number().positive("Amount must be positive").optional(),
      })
      .strict(),

    processRefund: z
      .object({
        notes: z.string().optional(),
      })
      .strict(),
  },

  coupon: {
    validateCoupon: z
      .object({
        code: z.string().min(3, "Coupon code is required"),
      })
      .strict(),

    createCoupon: z
      .object({
        code: z
          .string()
          .min(3, "Coupon code must be at least 3 characters")
          .max(50),
        type: z.enum(Object.values(CouponType), {
          required_error: "Coupon type is required",
        }),
        discount_value: z.number().min(0, "Discount value must be positive"),
        min_purchase_amount: z.number().min(0).optional(),
        max_uses: z.number().int().positive().optional(),
        max_uses_per_user: z.number().int().positive().optional(),
        valid_from: z.coerce.date().optional(),
        valid_until: z.coerce.date().optional(),
        is_active: z.boolean().optional(),
        applicable_tiers: z
          .array(z.enum(Object.values(SubscriptionTier)))
          .optional(),
        applicable_cycles: z
          .array(z.enum(Object.values(BillingCycle)))
          .optional(),
        purchase_types: z.array(z.enum(Object.values(PurchaseType))).optional(),
      })
      .strict(),

    updateCoupon: z
      .object({
        discount_value: z.number().min(0).optional(),
        min_purchase_amount: z.number().min(0).optional(),
        max_uses: z.number().int().positive().optional(),
        max_uses_per_user: z.number().int().positive().optional(),
        valid_from: z.coerce.date().optional(),
        valid_until: z.coerce.date().optional(),
        is_active: z.boolean().optional(),
        applicable_tiers: z
          .array(z.enum(Object.values(SubscriptionTier)))
          .optional(),
        applicable_cycles: z
          .array(z.enum(Object.values(BillingCycle)))
          .optional(),
        purchase_types: z.array(z.enum(Object.values(PurchaseType))).optional(),
      })
      .strict(),
  },

  feature: {
    createFeature: z
      .object({
        name: z
          .string()
          .min(3, "Feature name must be at least 3 characters")
          .max(100),
        description: z.string().optional(),
      })
      .strict(),

    updateFeature: z
      .object({
        name: z.string().min(3).max(100).optional(),
        description: z.string().optional(),
      })
      .strict(),

    assignFeatureToTier: z
      .object({
        tier: z.enum(Object.values(SubscriptionTier), {
          required_error: "Tier is required",
        }),
        enabled: z.boolean().optional(),
        limit: z.number().int().optional(),
      })
      .strict(),
  },

  event: {
    createEvent: z
      .object({
        name: z.string().min(3, "Name must be at least 3 characters"),
        description: z.string().optional(),
        event_type: z.string().optional(),
        start_date: z.coerce.date({
          invalid_type_error: "Invalid start date",
        }),
        end_date: z.coerce.date({ invalid_type_error: "Invalid end date" }),
        location: z.string().optional(),
        registration_capacity: z.coerce.number().int().positive().optional(),
        registration_fee: z.coerce.number().positive().optional(),
        registration_deadline: z.coerce.date().optional(),
        status: z.enum(Object.values(EventStatus)).optional(),
        is_active: z.coerce.boolean().optional(),
        banner: z.any().optional(),
      })
      .strict()
      .refine((data) => new Date(data.end_date) > new Date(data.start_date), {
        message: "End date must be after start date",
        path: ["end_date"],
      }),

    updateEvent: z
      .object({
        name: z.string().min(3).optional(),
        description: z.string().optional(),
        event_type: z.string().optional(),
        start_date: z.coerce.date().optional(),
        end_date: z.coerce.date().optional(),
        location: z.string().optional(),
        registration_capacity: z.coerce.number().int().positive().optional(),
        registration_fee: z.coerce.number().positive().optional(),
        registration_deadline: z.coerce.date().optional(),
        status: z.enum(Object.values(EventStatus)).optional(),
        is_active: z.coerce.boolean().optional(),
        banner: z.any().optional(),
      })
      .strict(),

    createStallBookingSetup: z
      .object({
        event_id: z.coerce.number().int().positive(),
        booking_deadline: z.coerce.date({
          invalid_type_error: "Invalid booking deadline",
        }),
        is_active: z.boolean().optional(),
      })
      .strict(),

    updateStallBookingSetup: z
      .object({
        booking_deadline: z.coerce.date().optional(),
        is_active: z.boolean().optional(),
      })
      .strict(),

    createStallCategory: z
      .object({
        stall_booking_setup_id: z.coerce.number().int().positive(),
        category_name: z.string().min(2, "Category name is required"),
        size: z.string().min(1, "Size is required"),
        price: z.coerce.number().positive("Price must be positive"),
        max_seats: z.coerce
          .number()
          .int()
          .positive("Max seats must be positive"),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      })
      .strict(),

    updateStallCategory: z
      .object({
        category_name: z.string().min(2).optional(),
        size: z.string().min(1).optional(),
        price: z.coerce.number().positive().optional(),
        max_seats: z.coerce.number().int().positive().optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      })
      .strict(),

    createSponsorshipSetup: z
      .object({
        event_id: z.coerce.number().int().positive(),
        is_active: z.boolean().optional(),
      })
      .strict(),

    updateSponsorshipSetup: z
      .object({
        is_active: z.boolean().optional(),
      })
      .strict(),

    createSponsorshipPackage: z
      .object({
        sponsorship_setup_id: z.coerce.number().int().positive(),
        package_name: z.string().min(2, "Package name is required"),
        price: z.coerce.number().positive("Price must be positive"),
        max_slots: z.coerce
          .number()
          .int()
          .positive("Max slots must be positive"),
        benefits: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
          }),
        ),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      })
      .strict(),

    updateSponsorshipPackage: z
      .object({
        package_name: z.string().min(2).optional(),
        price: z.coerce.number().positive().optional(),
        max_slots: z.coerce.number().int().positive().optional(),
        benefits: z
          .array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
            }),
          )
          .optional(),
        description: z.string().optional(),
        is_active: z.boolean().optional(),
      })
      .strict(),
  },
};

export { adminSchemas, schemas };
