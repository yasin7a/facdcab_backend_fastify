import httpStatus from "../utilities/httpStatus.js";
import { cleanupUploadedFiles } from "./fileUploader.js";

const validate = (zodSchema, customValidations = []) => {
  return async (request, reply) => {
    const errors = [];

    const isMultipart =
      typeof request.isMultipart === "function" && request.isMultipart();

    const dataToValidate = isMultipart
      ? request.upload?.fields || {}
      : request.body || {};

    // ---------------- Zod (ASYNC SAFE) ----------------
    if (zodSchema) {
      try {
        const validatedData = await zodSchema.parseAsync(dataToValidate);

        if (isMultipart) request.upload.fields = validatedData;
        else request.body = validatedData;
      } catch (error) {
        error.issues?.forEach((err) => {
          // Handle unrecognized keys from .strict()
          if (err.code === "unrecognized_keys") {
            const keys = err.keys.join(", ");
            const fieldPath = err.path.join(".");
            errors.push({
              field: fieldPath || keys,
              message: `Unknown field(s): ${keys}`,
            });
          } else {
            errors.push({
              field: err.path.join("."),
              message: err.message,
            });
          }
        });
      }
    }

    // ❌ ZOD FAILED → CLEAN FILES
    if (errors.length) {
      if (isMultipart) {
        await cleanupUploadedFiles(request);
      }

      return reply.code(httpStatus.UNPROCESSABLE_ENTITY).send({
        success: false,
        code: httpStatus.UNPROCESSABLE_ENTITY,
        message: "Validation failed",
        errors,
      });
    }

    // -------- custom validations (optional, async-safe) --------
    for (const fn of customValidations) {
      try {
        await fn(request);
      } catch (err) {
        errors.push({
          field: err.field || "unknown",
          message: err.message,
        });
      }
    }

    // ❌ CUSTOM VALIDATION FAILED → CLEAN FILES
    if (errors.length) {
      if (isMultipart) {
        await cleanupUploadedFiles(request);
      }

      return reply.code(httpStatus.UNPROCESSABLE_ENTITY).send({
        success: false,
        code: httpStatus.UNPROCESSABLE_ENTITY,
        message: "Validation failed",
        errors,
      });
    }
  };
};

export default validate;
