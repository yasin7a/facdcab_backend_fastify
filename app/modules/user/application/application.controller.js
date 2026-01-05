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
import {
  ApplicationStatus,
  BookingStatus,
  DocumentStatus,
} from "../../../utilities/constant.js";
import {
  generatePDFFromTemplate,
  sendPDFResponse,
} from "../../../utilities/pdfGenerator.js";
import { generateApplicationVisitPass } from "../../../utilities/codeGenerator.js";
import applicationTemplate from "../../../template/applicationVisitCardTemplate.js";

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
      include: {
        document_category: {
          select: {
            id: true,
            name: true,
          },
        },
        application_people: {
          include: {
            documents: {
              select: {
                status: true,
              },
            },
          },
        },
      },
    });

    const applicationModifiedData = data.data.map((app) => {
      // Calculate document counts per person and total
      const peopleWithDocumentCounts = app.application_people.map((person) => {
        const documentCounts = {
          pending: 0,
          approved: 0,
          rejected: 0,
          total: 0,
        };

        person.documents.forEach((document) => {
          documentCounts.total++;
          switch (document.status?.toLowerCase()) {
            case "pending":
              documentCounts.pending++;
              break;
            case "approved":
              documentCounts.approved++;
              break;
            case "rejected":
              documentCounts.rejected++;
              break;
          }
        });

        return {
          id: person.id,
          role: person.role,
          first_name: person.first_name,
          last_name: person.last_name,
          document_counts: documentCounts,
        };
      });

      return {
        id: app.id,
        document_category_id: app.document_category_id,
        document_category: app.document_category,
        status: app.status,
        created_at: app.created_at,
        appointment_date: app.appointment_date,
        time_slot: app.time_slot,
        metadata: app.metadata,
        application_people: peopleWithDocumentCounts,
      };
    });

    return sendResponse(reply, httpStatus.OK, "Application List", {
      ...data,
      data: applicationModifiedData,
    });
  });

  fastify.get("/show/:id", async (request, reply) => {
    const application_id = parseInt(request.params.id);

    const application = await prisma.application.findUnique({
      where: { id: application_id, user_id: request.auth_id },
      include: {
        application_people: {
          include: {
            documents: {
              include: {
                document_type: true,
                review: {
                  include: {
                    review_by: {
                      select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        document_category: true,
      },
    });

    if (!application) {
      throw throwError(httpStatus.NOT_FOUND, "Application Not Found");
    }

    // Add document counts per person
    const applicationWithCounts = {
      ...application,
      application_people: application.application_people.map((person) => {
        const documentCounts = {
          pending: 0,
          approved: 0,
          rejected: 0,
          total: 0,
        };

        person.documents.forEach((document) => {
          documentCounts.total++;
          switch (document.status?.toLowerCase()) {
            case "pending":
              documentCounts.pending++;
              break;
            case "approved":
              documentCounts.approved++;
              break;
            case "rejected":
              documentCounts.rejected++;
              break;
          }
        });

        return {
          ...person,
          document_counts: documentCounts,
        };
      }),
    };

    return sendResponse(
      reply,
      httpStatus.OK,
      "Application Details",
      applicationWithCounts
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
      const { metadata, is_submitted, document_category_id } = request.body;
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
          is_submitted,
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
        documents: {
          include: {
            review: {
              include: {
                review_by: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
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
            status: DocumentStatus.PENDING,
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
            documents: {
              include: {
                review: {
                  include: {
                    review_by: {
                      select: {
                        id: true,
                        first_name: true,
                        last_name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
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

  fastify.get("/available-slots", async (request, reply) => {
    const { date } = request.query;

    if (!date) {
      throw throwError(httpStatus.BAD_REQUEST, "Date is required");
    }

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    const officeHours = await prisma.officeHours.findFirst();

    if (!officeHours) {
      throw throwError(httpStatus.NOT_FOUND, "Office hours not configured");
    }

    if (officeHours.weekend_days.includes(dayOfWeek)) {
      return sendResponse(
        reply,
        httpStatus.OK,
        "Selected date is a weekend",
        []
      );
    }

    const timeSlots = generateTimeSlots(
      officeHours.start_time,
      officeHours.end_time,
      officeHours.appointment_duration
    );

    const totalDesks = await prisma.desk.count({
      where: { is_active: true },
    });

    if (totalDesks === 0) {
      return sendResponse(reply, httpStatus.OK, "No desks available", []);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await prisma.application.groupBy({
      by: ["time_slot"],
      where: {
        appointment_date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        booking_status: BookingStatus.BOOKED,
      },
      _count: {
        time_slot: true,
      },
    });

    const bookingsPerSlot = {};
    bookedAppointments.forEach((item) => {
      bookingsPerSlot[item.time_slot] = item._count.time_slot;
    });

    const availableSlots = timeSlots
      .map((slot) => {
        const booked = bookingsPerSlot[slot] || 0;
        const available = totalDesks - booked;

        return {
          time: slot,
          available: available > 0,
          available_desks: available,
          total_desks: totalDesks,
        };
      })
      .filter((slot) => slot.available);

    return sendResponse(
      reply,
      httpStatus.OK,
      "Available slots retrieved",
      availableSlots
    );
  });

  fastify.post("/book-appointment", async (request, reply) => {
    const { date, time_slot, notes, application_id } = request.body;

    if (!date || !time_slot || !application_id) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "date, time_slot, and application_id are required"
      );
    }

    const selectedDate = new Date(date);
    const dayOfWeek = selectedDate.getDay();

    const officeHours = await prisma.officeHours.findFirst();

    if (!officeHours) {
      throw throwError(httpStatus.NOT_FOUND, "Office hours not configured");
    }

    if (officeHours.weekend_days.includes(dayOfWeek)) {
      throw throwError(httpStatus.BAD_REQUEST, "Cannot book on weekends");
    }

    // Generate available time slots to validate the requested time
    const timeSlots = generateTimeSlots(
      officeHours.start_time,
      officeHours.end_time,
      officeHours.appointment_duration
    );

    // Normalize the input time format to match generated format
    const normalizedTimeSlot = normalizeTimeFormat(time_slot);

    // Validate that the requested time_slot is within office hours
    if (!timeSlots.includes(normalizedTimeSlot)) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        `Invalid time slot. Available slots are: ${timeSlots.join(", ")}`
      );
    }

    const totalDesks = await prisma.desk.count({
      where: { is_active: true },
    });

    if (totalDesks === 0) {
      throw throwError(httpStatus.BAD_REQUEST, "No desks available");
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedCount = await prisma.application.count({
      where: {
        appointment_date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        time_slot: normalizedTimeSlot,
        booking_status: BookingStatus.BOOKED,
      },
    });

    if (bookedCount >= totalDesks) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "No desks available for this time slot. All desks are booked."
      );
    }

    const existingApplication = await prisma.application.findUnique({
      where: { id: parseInt(application_id), user_id: request.auth_id },
    });

    if (!existingApplication) {
      throw throwError(httpStatus.NOT_FOUND, "Application not found");
    }
    // if already booked show error
    if (existingApplication.booking_status === BookingStatus.BOOKED) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "Appointment already booked for this application"
      );
    }

    if (existingApplication.status !== ApplicationStatus.APPROVED) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "Only approved applications can be booked"
      );
    }

    const updatedApplication = await prisma.application.update({
      where: { id: parseInt(application_id), user_id: request.auth_id },
      data: {
        appointment_date: selectedDate,
        time_slot: normalizedTimeSlot,
        metadata: { ...existingApplication.metadata, notes },
        booking_status: BookingStatus.BOOKED,
      },
    });

    return sendResponse(
      reply,
      httpStatus.CREATED,
      "Appointment booked. Please check in when you arrive.",
      updatedApplication
    );
  });

  fastify.post("/cancel-appointment", async (request, reply) => {
    const { application_id } = request.body;
    if (!application_id) {
      throw throwError(httpStatus.BAD_REQUEST, "application_id is required");
    }
    const existingApplication = await prisma.application.findUnique({
      where: { id: parseInt(application_id), user_id: request.auth_id },
    });
    if (!existingApplication) {
      throw throwError(httpStatus.NOT_FOUND, "Application not found");
    }
    if (existingApplication.booking_status !== BookingStatus.BOOKED) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "Only booked applications can be cancelled"
      );
    }
    const updatedApplication = await prisma.application.update({
      where: { id: parseInt(application_id), user_id: request.auth_id },
      data: { booking_status: BookingStatus.CANCELLED },
    });
    return sendResponse(
      reply,
      httpStatus.OK,
      "Appointment cancelled",
      updatedApplication
    );
  });

  fastify.get(
    "/generate-application-visit/:application_id",
    async (request, reply) => {
      const application_id = Number(request.params.application_id);

      if (!application_id) {
        throw throwError(httpStatus.BAD_REQUEST, "Invalid application ID");
      }

      const application = await prisma.application.findUnique({
        where: { id: application_id, user_id: request.auth_id },
        include: {
          user: true,
          document_category: {
            select: {
              id: true,
              name: true,
              document_types: {
                select: {
                  id: true,
                  name: true,
                  is_required: true,
                },
              },
            },
          },
          application_people: {
            include: {
              documents: {
                include: {
                  document_type: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!application) {
        throw throwError(httpStatus.NOT_FOUND, "Application not found");
      }

      // Prepare dynamic application data
      const applicationData = {
        id: `APT-${new Date().getFullYear()}-${String(application_id).padStart(
          3,
          "0"
        )}`,
        status: application.status || "PENDING",
        category: application.document_category?.name || "Visa Application",
        applicant_name:
          application.user?.first_name + " " + application.user?.last_name ||
          "N/A",
        applicant_email: application.user?.email || "N/A",
        appointment_date:
          application.appointment_date?.toISOString().split("T")[0] || null,
        appointment_time: application.time_slot,
        created_at: application.created_at,
        metadata: application.metadata,
      };

      // Generate QR code
      const { qrCode } = await generateApplicationVisitPass(applicationData);
      applicationData.qrCode = qrCode;

      let pdfBuffer;
      try {
        pdfBuffer = await generatePDFFromTemplate({
          template: applicationTemplate,
          data: applicationData,
          pdfOptions: {
            format: "A4",
            printBackground: true,
            margin: {
              top: "20px",
              right: "20px",
              bottom: "20px",
              left: "20px",
            },
          },
          pageOptions: {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          },
        });
      } catch (error) {
        throw error;
      }

      if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
        throw throwError(
          httpStatus.INTERNAL_SERVER_ERROR,
          "PDF generation failed - invalid buffer returned"
        );
      }

      return sendPDFResponse(
        reply,
        pdfBuffer,
        `appointment-pass-${applicationData.id}.pdf`
      );
    }
  );
}
function normalizeTimeFormat(timeStr) {
  // Convert "9:30 AM" to "09:30 AM" to match the format generated by generateTimeSlots
  const [time, period] = timeStr.trim().split(" ");
  const [hours, minutes] = time.split(":");

  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")} ${period}`;
}

function generateTimeSlots(startTime, endTime, duration) {
  // Helper function to convert 12-hour format to 24-hour format
  function convertTo24Hour(time12h) {
    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier === "AM" && hours === 12) {
      hours = 0;
    } else if (modifier === "PM" && hours !== 12) {
      hours += 12;
    }

    return { hours, minutes };
  }

  // Helper function to convert 24-hour format to 12-hour format
  function convertTo12Hour(hours, minutes) {
    let period = "AM";
    let displayHours = hours;

    if (hours === 0) {
      displayHours = 12;
    } else if (hours === 12) {
      period = "PM";
    } else if (hours > 12) {
      displayHours = hours - 12;
      period = "PM";
    }

    return `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )} ${period}`;
  }

  const slots = [];
  const start = convertTo24Hour(startTime);
  const end = convertTo24Hour(endTime);

  let currentHour = start.hours;
  let currentMin = start.minutes;

  while (
    currentHour < end.hours ||
    (currentHour === end.hours && currentMin < end.minutes)
  ) {
    const timeStr = convertTo12Hour(currentHour, currentMin);
    slots.push(timeStr);

    currentMin += duration;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
  }

  return slots;
}
export default applicationController;
