import { prisma } from "../../../lib/prisma.js";
import { schemas } from "../../../validators/validations.js";
import offsetPagination from "../../../utilities/offsetPagination.js";
import sendResponse from "../../../utilities/sendResponse.js";
import httpStatus from "../../../utilities/httpStatus.js";
import throwError from "../../../utilities/throwError.js";
import validate from "../../../middleware/validate.js";
import {
  fileUploadPreHandler,
  deleteFiles,
} from "../../../middleware/fileUploader.js";

async function applicationController(fastify, options) {
  fastify.get("/list", async (request, reply) => {
    const { search, page, limit } = request.query;
    const where = {
      user_id: request.auth_id,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const data = await offsetPagination({
      model: prisma.application,
      where,
      page: page,
      limit: limit,
      orderBy: { created_at: "desc" },
    });

    return sendResponse(reply, httpStatus.OK, "Application List", data);
  });

  fastify.get("/show/:id", async (request, reply) => {
    const application_id = parseInt(request.params.id);

    const application = await prisma.application.findUnique({
      where: { id: application_id, user_id: request.auth_id },
      include: {
        application_people: {
          include: {
            documents: true,
          },
        },
        document_category: true,
      },
    });

    if (!application) {
      throw throwError(httpStatus.NOT_FOUND, "Application Not Found");
    }

    return sendResponse(
      reply,
      httpStatus.OK,
      "Application Details",
      application
    );
  });

  fastify.post(
    "/create",
    { preHandler: validate(schemas.createApplication) },
    async (request, reply) => {
      const {
        document_category_id,
        application_people_count = 0,
        metadata,
      } = request.body;

      const application = await prisma.$transaction(async (tx) => {
        // Create application
        const app = await tx.application.create({
          data: {
            document_category_id,
            user_id: request.auth_id,
            metadata,
          },
        });

        // Create people if needed
        if (application_people_count > 0) {
          await tx.applicationPerson.createMany({
            data: Array.from(
              { length: application_people_count },
              (_, index) => ({
                application_id: app.id,
                role: "APPLICANT_" + (index + 1),
              })
            ),
          });
        }

        // Return full application
        return tx.application.findUnique({
          where: { id: app.id },
          include: {
            application_people: true,
            document_category: true,
          },
        });
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Application Created",
        application
      );
    }
  );

  fastify.put(
    "/update/:id",
    { preHandler: validate(schemas.updateApplication) },

    async (request, reply) => {
      const application_id = parseInt(request.params.id);
      const { preferred_date, metadata, status, document_category_id } =
        request.body;
      // check application exists
      const existingApplication = await prisma.application.findUnique({
        where: { id: application_id, user_id: request.auth_id },
      });
      if (!existingApplication) {
        throw throwError(httpStatus.NOT_FOUND, "Application Not Found");
      }

      const application = await prisma.application.update({
        where: { id: application_id, user_id: request.auth_id },
        data: {
          preferred_date,
          status,
          document_category_id,
          metadata: { ...existingApplication.metadata, ...metadata },
        },
      });

      return sendResponse(
        reply,
        httpStatus.OK,
        "Application Updated",
        application
      );
    }
  );

  fastify.get("/applicant_person/show", async (request, reply) => {
    const application_id = parseInt(request.query.application_id);
    const application_person_id = parseInt(request.query.application_person_id);

    // check application person exists
    const existingPerson = await prisma.applicationPerson.findUnique({
      where: {
        id: application_person_id,
        application_id: application_id,
        application: { user_id: request.auth_id },
      },
      include: {
        documents: true,
        application: {
          include: {
            document_category: {
              select: {
                document_types: true,
              },
            },
          },
        },
      },
    });

    if (!existingPerson) {
      throw throwError(httpStatus.NOT_FOUND, "Application Person Not Found");
    }

    return sendResponse(
      reply,
      httpStatus.OK,
      "Application Details",
      existingPerson
    );
  });

  fastify.put(
    "/applicant_person/update",
    { preHandler: validate(schemas.updateApplicationPerson) },

    async (request, reply) => {
      const { application_id, application_people } = request.body;

      // First, verify the application exists and belongs to the user
      const existingApplication = await prisma.application.findUnique({
        where: {
          id: application_id,
          user_id: request.auth_id,
        },
      });

      if (!existingApplication) {
        throw throwError(httpStatus.NOT_FOUND, "Application Not Found");
      }

      // Extract all person IDs to verify they exist and belong to this application
      const personIds = application_people.map(
        (person) => person.application_person_id
      );

      // Verify all persons exist and belong to this application
      const existingPersons = await prisma.applicationPerson.findMany({
        where: {
          id: { in: personIds },
          application_id: application_id,
        },
        select: { id: true, role: true, first_name: true, last_name: true },
      });

      if (existingPersons.length !== personIds.length) {
        const foundIds = existingPersons.map((p) => p.id);
        const missingIds = personIds.filter((id) => !foundIds.includes(id));
        const missingRoles = application_people
          .filter((p) => missingIds.includes(p.application_person_id))
          .map(
            (p) => `ID: ${p.application_person_id}, Role: ${p.role || "N/A"}`
          )
          .join("; ");
        throw throwError(
          httpStatus.NOT_FOUND,
          `Application Persons Not Found - ${missingRoles}`
        );
      }

      // Update all persons in a transaction
      const updatedPersons = await prisma.$transaction(
        application_people.map((person) =>
          prisma.applicationPerson.update({
            where: { id: person.application_person_id },
            data: {
              first_name: person.first_name,
              last_name: person.last_name,
              role: person.role,
              dob: person.dob,
              phone_number: person.phone_number,
              email: person.email,
              passport_number: person.passport_number,
            },
          })
        )
      );

      return sendResponse(
        reply,
        httpStatus.OK,
        `${updatedPersons.length} Application Person(s) Updated`,
        updatedPersons
      );
    }
  );

  fastify.post(
    "/applicant_person/upload-document",
    {
      preHandler: fileUploadPreHandler({
        folder: "documents",
        allowedTypes: ["image", "docs"],
        fieldLimits: { document: 1 },
        maxFileSizeInMB: 5,
        schema: (request) => schemas.uploadApplicantDocument(request),
      }),
    },
    async (request, reply) => {
      const { document_id, application_person_id, document_type_id } =
        request.upload?.fields || request.body;

      let document;

      // UPDATE (document_id provided)
      if (document_id) {
        document = await prisma.document.update({
          where: { id: document_id },
          data: {
            application_person_id,
            document_type_id,
            file: request.upload.files.document,
          },
        });
      }
      // CREATE (document_id not provided)
      else {
        document = await prisma.document.create({
          data: {
            application_person_id,
            document_type_id,
            file: request.upload.files.document,
          },
        });
      }

      return sendResponse(
        reply,
        httpStatus.OK,
        document_id
          ? "Document updated successfully"
          : "Document uploaded successfully",
        document
      );
    }
  );

  fastify.delete(
    "/applicant_person/document/delete",
    async (request, reply) => {
      // zod will ensure these are integers
      const application_person_id = parseInt(
        request.query.application_person_id
      );
      const application_id = parseInt(request.query.application_id);
      const document_id = parseInt(request.query.document_id);
      // check application person exists
      const existingPerson = await prisma.applicationPerson.findUnique({
        where: {
          id: application_person_id,
          application_id: application_id,
          application: { user_id: request.auth_id },
        },
        include: {
          application: true,
        },
      });
      if (!existingPerson) {
        throw throwError(httpStatus.NOT_FOUND, "Application Person Not Found");
      }
      // check document exists
      const existingDocument = await prisma.document.findFirst({
        where: {
          id: document_id,
          application_person_id: existingPerson.id,
        },
      });
      if (!existingDocument) {
        throw throwError(httpStatus.NOT_FOUND, "Document Not Found");
      }
      /// delete document logic here
      const deletedDocument = await prisma.document.delete({
        where: { id: existingDocument.id },
      });
      // delete file if exists
      if (deletedDocument.file?.path) {
        await deleteFiles(deletedDocument.file.path);
      }

      return sendResponse(reply, httpStatus.OK, "Document Deleted", null);
    }
  );

  fastify.delete("/delete/:id", async (request, reply) => {
    const application_id = parseInt(request.params.id);

    // 1️⃣ Fetch the application with related people and documents
    const application = await prisma.application.findUnique({
      where: { id: application_id, user_id: request.auth_id },
      include: {
        application_people: {
          include: {
            documents: true,
          },
        },
      },
    });

    if (!application) {
      throw throwError(httpStatus.NOT_FOUND, "Application Not Found");
    }

    // 2️⃣ Collect all file paths to delete
    const filesToDelete = [];
    for (const person of application.application_people) {
      for (const document of person.documents) {
        if (document.file?.path) {
          filesToDelete.push(document.file.path);
        }
      }
    }

    // 3️⃣ Delete files first
    if (filesToDelete.length > 0) {
      try {
        await deleteFiles(filesToDelete);
      } catch (error) {
        console.error("Error deleting files:", error);
        // Continue with database deletion even if file deletion fails
      }
    }

    // 4️⃣ Delete database records safely using transaction
    const deletedApplication = await prisma.$transaction(async (tx) => {
      for (const person of application.application_people) {
        // Delete documents for this person
        await tx.document.deleteMany({
          where: { application_person_id: person.id },
        });

        // Delete the application_people record
        await tx.applicationPerson.delete({
          where: { id: person.id },
        });
      }

      // Delete the application itself
      return tx.application.delete({
        where: { id: application_id },
      });
    });

    // 5️⃣ Send response
    return sendResponse(
      reply,
      httpStatus.OK,
      "Application and all associated documents deleted successfully"
    );
  });
}

export default applicationController;
