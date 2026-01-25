// Event Service
import { prisma } from "../lib/prisma.js";
import InvoiceService from "./invoice.service.js";
import {
  EventStatus,
  StallBookingPurchaseStatus,
  SponsorshipStatus,
  PaymentStatus,
} from "../utilities/constant.js";
import throwError from "../utilities/throwError.js";
import httpStatus from "../utilities/httpStatus.js";
import { generateInvoiceNumber } from "../utilities/generateInvoiceNumber.js";

class EventService {
  constructor() {
    this.invoiceService = new InvoiceService();
  }

  /**
   * Create stall booking with invoice
   */
  async createStallBooking(data) {
    const { event_id, stall_category_id, user_id, quantity, billing_info } =
      data;

    // Verify event and category
    const event = await prisma.event.findUnique({
      where: { id: event_id },
      include: {
        stall_booking_setup: {
          include: {
            categories: {
              where: { id: stall_category_id },
            },
          },
        },
      },
    });

    if (!event || !event.stall_booking_setup) {
      throw throwError(httpStatus.NOT_FOUND, "Event or stall setup not found");
    }

    const category = event.stall_booking_setup.categories[0];
    if (!category) {
      throw throwError(httpStatus.NOT_FOUND, "Stall category not found");
    }

    // Check availability
    const availableSeats = category.max_seats - category.booked_seats;
    if (availableSeats < quantity) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        `Only ${availableSeats} stalls available`,
      );
    }

    // Check booking deadline
    if (new Date() > event.stall_booking_setup.booking_deadline) {
      throw throwError(httpStatus.BAD_REQUEST, "Booking deadline has passed");
    }

    // Calculate total amount
    const totalAmount = category.price * quantity;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: await generateInvoiceNumber(),
        user_id,
        purchase_type: "STALL_BOOKING",
        subtotal: totalAmount,
        amount: totalAmount,
        currency: "BDT",
        status: PaymentStatus.PENDING,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        billing_address: billing_info,
        description: `Stall booking for ${event.title} - ${category.category_name}`,
        items: {
          create: {
            name: `${category.category_name} Stall`,
            description: `Size: ${category.size}`,
            quantity,
            unit_price: category.price,
            total_price: totalAmount,
            metadata: {
              event_id,
              stall_category_id,
              category_name: category.category_name,
              size: category.size,
            },
          },
        },
      },
    });

    // Create stall booking purchase
    const booking = await prisma.stallBookingPurchase.create({
      data: {
        event_id,
        stall_category_id,
        user_id,
        invoice_id: invoice.id,
        quantity,
        status: StallBookingPurchaseStatus.PENDING,
        ...data.booking_details,
      },
    });

    // Update booked seats
    await prisma.stallCategory.update({
      where: { id: stall_category_id },
      data: { booked_seats: { increment: quantity } },
    });

    return { booking, invoice };
  }

  /**
   * Create sponsorship purchase with invoice
   */
  async createSponsorshipPurchase(data) {
    const { event_id, sponsorship_package_id, user_id, billing_info } = data;

    // Verify event and package
    const event = await prisma.event.findUnique({
      where: { id: event_id },
      include: {
        sponsorship_setup: {
          include: {
            packages: {
              where: { id: sponsorship_package_id },
            },
          },
        },
      },
    });

    if (!event || !event.sponsorship_setup) {
      throw throwError(
        httpStatus.NOT_FOUND,
        "Event or sponsorship setup not found",
      );
    }

    const sponsorshipPackage = event.sponsorship_setup.packages[0];
    if (!sponsorshipPackage) {
      throw throwError(httpStatus.NOT_FOUND, "Sponsorship package not found");
    }

    // Check availability
    const availableSlots =
      sponsorshipPackage.max_slots - sponsorshipPackage.booked_slots;
    if (availableSlots < 1) {
      throw throwError(
        httpStatus.BAD_REQUEST,
        "No sponsorship slots available",
      );
    }

    const totalAmount = sponsorshipPackage.price;

    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoice_number: await generateInvoiceNumber(),
        user_id,
        purchase_type: "SPONSORSHIP",
        subtotal: totalAmount,
        amount: totalAmount,
        currency: "BDT",
        status: PaymentStatus.PENDING,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        billing_address: billing_info,
        description: `Sponsorship for ${event.title} - ${sponsorshipPackage.package_name}`,
        items: {
          create: {
            name: `${sponsorshipPackage.package_name} Sponsorship`,
            description: sponsorshipPackage.description || "",
            quantity: 1,
            unit_price: totalAmount,
            total_price: totalAmount,
            metadata: {
              event_id,
              sponsorship_package_id,
              package_name: sponsorshipPackage.package_name,
              benefits: sponsorshipPackage.benefits,
            },
          },
        },
      },
    });

    // Create sponsorship purchase
    const purchase = await prisma.sponsorshipPurchase.create({
      data: {
        event_id,
        sponsorship_package_id,
        user_id,
        invoice_id: invoice.id,
        status: SponsorshipStatus.PENDING,
        ...data.purchase_details,
      },
    });

    // Update booked slots
    await prisma.sponsorshipPackage.update({
      where: { id: sponsorship_package_id },
      data: { booked_slots: { increment: 1 } },
    });

    return { purchase, invoice };
  }

  /**
   * Confirm stall booking after payment
   */
  async confirmStallBooking(booking_id) {
    return await prisma.stallBookingPurchase.update({
      where: { id: booking_id },
      data: { status: StallBookingPurchaseStatus.CONFIRMED },
    });
  }

  /**
   * Confirm sponsorship after payment
   */
  async confirmSponsorshipPurchase(purchase_id) {
    return await prisma.sponsorshipPurchase.update({
      where: { id: purchase_id },
      data: { status: SponsorshipStatus.CONFIRMED },
    });
  }

  /**
   * Cancel stall booking
   */
  async cancelStallBooking(booking_id) {
    const booking = await prisma.stallBookingPurchase.findUnique({
      where: { id: booking_id },
    });

    if (!booking) {
      throw throwError(httpStatus.NOT_FOUND, "Booking not found");
    }

    // Decrement booked seats
    await prisma.stallCategory.update({
      where: { id: booking.stall_category_id },
      data: { booked_seats: { decrement: booking.quantity } },
    });

    return await prisma.stallBookingPurchase.update({
      where: { id: booking_id },
      data: { status: StallBookingPurchaseStatus.CANCELLED },
    });
  }

  /**
   * Cancel sponsorship purchase
   */
  async cancelSponsorshipPurchase(purchase_id) {
    const purchase = await prisma.sponsorshipPurchase.findUnique({
      where: { id: purchase_id },
    });

    if (!purchase) {
      throw throwError(httpStatus.NOT_FOUND, "Purchase not found");
    }

    // Decrement booked slots
    await prisma.sponsorshipPackage.update({
      where: { id: purchase.sponsorship_package_id },
      data: { booked_slots: { decrement: 1 } },
    });

    return await prisma.sponsorshipPurchase.update({
      where: { id: purchase_id },
      data: { status: SponsorshipStatus.CANCELLED },
    });
  }

  /**
   * Get event statistics
   */
  async getEventStats(event_id) {
    const [stallBookings, sponsorships, totalRevenue] = await Promise.all([
      prisma.stallBookingPurchase.count({
        where: { event_id, status: StallBookingPurchaseStatus.CONFIRMED },
      }),
      prisma.sponsorshipPurchase.count({
        where: { event_id, status: SponsorshipStatus.CONFIRMED },
      }),
      prisma.invoice.aggregate({
        where: {
          OR: [
            { stall_booking: { event_id } },
            { sponsorship_purchase: { event_id } },
          ],
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
    ]);

    // Get separate revenue for stalls and sponsorships
    const [stallRevenue, sponsorshipRevenue] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          stall_booking: { event_id },
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
      prisma.invoice.aggregate({
        where: {
          sponsorship_purchase: { event_id },
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      total_stall_bookings: stallBookings || 0,
      stall_revenue: stallRevenue._sum.amount || 0,
      total_sponsorships: sponsorships || 0,
      sponsorship_revenue: sponsorshipRevenue._sum.amount || 0,
      total_revenue: totalRevenue._sum.amount || 0,
    };
  }
}

export default EventService;
