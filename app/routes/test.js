import {
  deleteFiles,
  fileUploadPreHandler,
} from "../middleware/fileUploader.js";
import validate from "../middleware/validate.js";
import httpStatus from "../utilities/httpStatus.js";
import { otpSendMail } from "../utilities/otp.js";
import sendResponse from "../utilities/sendResponse.js";
import throwError from "../utilities/throwError.js";
import { schemas } from "../validators/validations.js";

async function testRoutes(fastify, options) {
  // Test error route
  fastify.post("/test-error", async (request, reply) => {
    const { error } = request.body;
    if (error) {
      throw throwError(httpStatus.BAD_REQUEST, "Test Error");
    }
    return sendResponse(reply, httpStatus.OK, "success");
  });
  // make slow api route for testing performance hook
  fastify.get("/slow-api", async (request, reply) => {
    // simulate a slow request
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return sendResponse(reply, httpStatus.OK, "This was a slow API response");
  });

  // Test mail route
  fastify.post("/test-mail", async (request, reply) => {
    await otpSendMail(request.body.email, "1234");
    return sendResponse(reply, httpStatus.OK, "Test Mail Sent");
  });

  // File upload endpoint with validation
  fastify.post(
    "/file-upload",
    {
      preHandler: fileUploadPreHandler({
        folder: "documents",
        allowedTypes: ["image", "docs"],
        fieldLimits: {
          avatar: 2,
          documents: 5,
          another_file: 2,
        },
        maxFileSizeInMB: 110,
        schema: schemas.testFileUploadApiValidation,
      }),
    },
    async (req, reply) => {
      return {
        success: true,
        data: req.upload,
      };
    }
  );

  // Delete file(s) endpoint
  fastify.post(
    "/delete-file",
    {
      preHandler: validate(schemas.deleteFile),
    },
    async (request, reply) => {
      const { urls } = request.body;

      const results = await deleteFiles(urls);

      return sendResponse(reply, httpStatus.OK, "Delete operation completed", {
        results,
      });
    }
  );
}

export default testRoutes;
