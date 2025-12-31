import { fileTypeFromBuffer } from "file-type";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import serverConfig from "../../config/server.config.js";
import generateRandomId from "../utilities/generateRandomId.js";
import throwError from "../utilities/throwError.js";
import httpStatus from "../utilities/httpStatus.js";
import validate from "./validate.js";

const FILE_TYPES = {
  image: {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  },
  docs: {
    ".pdf": "application/pdf",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".csv": "text/csv",
  },
};

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const RESOLVED_UPLOAD_DIR = UPLOAD_DIR;
const HEADER_SIZE = 4100;

function resolveFileType(ext, allowedTypes) {
  for (const type of allowedTypes) {
    if (FILE_TYPES[type]?.[ext]) {
      return { category: type, mime: FILE_TYPES[type][ext] };
    }
  }
  return null;
}

const safeFilename = (name, ext) =>
  name
    .replace(ext, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 50);

export async function fileUploader(request, reply, options = {}) {
  const {
    folder = "",
    allowedTypes = [],
    fieldLimits = {},
    maxFileSize,
  } = options;

  if (!request.isMultipart()) {
    throw throwError(httpStatus.BAD_REQUEST, "multipart/form-data required");
  }

  const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_");
  const uploadDir = path.join(UPLOAD_DIR, sanitizedFolder);
  await fs.promises.mkdir(uploadDir, { recursive: true });

  // Normalize field limits to numbers
  const normalizedFieldLimits = Object.fromEntries(
    Object.entries(fieldLimits).map(([k, v]) => [k, Number(v)])
  );

  const fields = {};
  const files = {};
  const fieldCounters = {};
  request.savedFiles = [];

  const cleanupAll = async () =>
    Promise.allSettled(
      request.savedFiles.map((f) => fs.promises.unlink(f).catch(() => {}))
    );

  try {
    for await (const part of request.parts({
      limits: { fileSize: maxFileSize },
    })) {
      if (part.type === "file") {
        if (!part.filename) {
          part.file.resume();
          continue;
        }

        const field = part.fieldname;

        // Reject unknown fields
        if (
          Object.keys(normalizedFieldLimits).length &&
          !normalizedFieldLimits[field]
        ) {
          part.file.resume();
          throw throwError(
            httpStatus.BAD_REQUEST,
            `File field '${field}' is not allowed`
          );
        }

        // Enforce per-field count
        fieldCounters[field] = (fieldCounters[field] || 0) + 1;
        if (fieldCounters[field] > normalizedFieldLimits[field]) {
          part.file.resume();
          throw throwError(
            httpStatus.BAD_REQUEST,
            `Max ${normalizedFieldLimits[field]} file(s) allowed for field '${field}'`
          );
        }

        const ext = path.extname(part.filename).toLowerCase();
        const resolved = resolveFileType(ext, allowedTypes);
        if (!resolved) {
          part.file.resume();
          throw throwError(httpStatus.BAD_REQUEST, "File type not allowed");
        }

        const base = safeFilename(part.filename, ext);
        const filename = `${base}_${Date.now()}_${generateRandomId()}${ext}`;
        const finalPath = path.join(uploadDir, filename);

        const tempHeader = [];
        let headerLength = 0;
        const writeStream = fs.createWriteStream(finalPath, { flags: "wx" });

        try {
          // Collect header for MIME validation
          part.file.on("data", (chunk) => {
            if (headerLength < HEADER_SIZE) {
              const bytesToTake = Math.min(
                chunk.length,
                HEADER_SIZE - headerLength
              );
              tempHeader.push(chunk.slice(0, bytesToTake));
              headerLength += bytesToTake;
            }
          });

          // Stream file to disk
          await pipeline(part.file, writeStream);

          // Check truncated flag (file too large)
          if (part.file.truncated) {
            await fs.promises.unlink(finalPath).catch(() => {});
            const sizeInMB = (maxFileSize / 1024 / 1024).toFixed(2);
            throw throwError(
              413,
              `File size exceeds the limit of ${sizeInMB} MB: '${part.filename}'`
            );
          }

          // Validate MIME type if possible
          const headerBuffer = Buffer.concat(tempHeader);
          let detected = null;

          if (headerBuffer.length > 0) {
            detected = await fileTypeFromBuffer(headerBuffer);

            // Strict MIME validation only if detection succeeds
            if (detected && detected.mime !== resolved.mime) {
              await fs.promises.unlink(finalPath);
              throw throwError(
                httpStatus.BAD_REQUEST,
                "Invalid file content - file type mismatch"
              );
            }
          }

          // Save successfully uploaded file
          request.savedFiles.push(finalPath);
          const relativePath = path
            .join(sanitizedFolder, filename)
            .replace(/\\/g, "/");
          const { size } = await fs.promises.stat(finalPath);

          (files[field] ??= []).push({
            fieldname: field,
            originalName: part.filename,
            filename,
            category: resolved.category,
            mimetype: detected?.mime || resolved.mime,
            size,
            path: relativePath,
            url: `${serverConfig.BASE_URL.replace(
              /\/$/,
              ""
            )}/uploads/${relativePath}`,
          });
        } catch (err) {
          writeStream.destroy();
          part.file.destroy();
          await fs.promises.unlink(finalPath).catch(() => {});
          throw err;
        }
      } else {
        // Handle normal fields
        const existing = fields[part.fieldname];
        fields[part.fieldname] =
          existing !== undefined
            ? Array.isArray(existing)
              ? [...existing, part.value]
              : [existing, part.value]
            : part.value;
      }
    }

    // Normalize array notation fields (e.g., "field[0]", "field[1]" -> "field": [val1, val2])
    const normalizedFields = {};
    const arrayFields = {};

    for (const [key, value] of Object.entries(fields)) {
      const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, fieldName, index] = arrayMatch;
        if (!arrayFields[fieldName]) {
          arrayFields[fieldName] = [];
        }
        arrayFields[fieldName][parseInt(index)] = value;
      } else {
        normalizedFields[key] = value;
      }
    }

    // Merge array fields into normalized fields and parse numbers
    for (const [fieldName, arr] of Object.entries(arrayFields)) {
      normalizedFields[fieldName] = arr
        .filter((v) => v !== undefined)
        .map((v) => {
          // Try to parse as number if it looks like a number
          if (typeof v === "string" && !isNaN(v) && v.trim() !== "") {
            return Number(v);
          }
          return v;
        });
    }

    request.upload = {
      fields: normalizedFields,
      files: Object.fromEntries(
        Object.entries(files).map(([k, v]) => [k, v.length === 1 ? v[0] : v])
      ),
    };

    return request.upload;
  } catch (err) {
    await cleanupAll();
    request.savedFiles = [];
    throw err;
  }
}

export async function cleanupUploadedFiles(request) {
  if (!Array.isArray(request.savedFiles)) return;
  await Promise.allSettled(
    request.savedFiles.map((file) => fs.promises.unlink(file).catch(() => {}))
  );
}

export const fileUploadPreHandler = ({
  folder = "documents",
  allowedTypes = ["image", "docs"],
  fieldLimits = {},
  maxFileSizeInMB = 10,
  schema = null,
  customValidations = [],
} = {}) => {
  return async (req, reply) => {
    await fileUploader(req, reply, {
      folder,
      allowedTypes,
      fieldLimits,
      maxFileSize: maxFileSizeInMB * 1024 * 1024,
    });

    // Handle dynamic schema (function) or static schema
    const resolvedSchema = typeof schema === "function" ? schema(req) : schema;

    if (resolvedSchema || (customValidations && customValidations.length)) {
      await validate(resolvedSchema, customValidations)(req, reply);
    }
  };
};

export async function deleteFiles(relativePaths) {
  const paths = Array.isArray(relativePaths) ? relativePaths : [relativePaths];

  const success = [];
  const failed = [];

  await Promise.allSettled(
    paths.map(async (relativePath) => {
      if (!relativePath || typeof relativePath !== "string") {
        failed.push({ path: relativePath, error: "Invalid file path" });
        return;
      }

      // Remove URL prefix if present
      relativePath = relativePath.replace(/^\/?uploads\//, "");

      const filePath = path.join(UPLOAD_DIR, relativePath);
      const resolvedPath = path.resolve(filePath);

      // Security check
      if (!resolvedPath.startsWith(RESOLVED_UPLOAD_DIR)) {
        failed.push({ path: relativePath, error: "Invalid file path" });
        return;
      }

      try {
        await fs.promises.unlink(resolvedPath);
        success.push(relativePath);
      } catch (err) {
        failed.push({
          path: relativePath,
          error: err.code === "ENOENT" ? "File not found" : err.message,
        });
      }
    })
  );

  return { success, failed };
}
