export const UserType = {
  STAFF: "STAFF",
  USER: "USER",
  ADMIN: "ADMIN",
};

export const DocumentStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const ApplicationStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const BookingStatus = {
  BOOKED: "BOOKED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
};

export const DeskStatus = {
  AVAILABLE: "AVAILABLE",
  BUSY: "BUSY",
  BREAK: "BREAK",
};

export const QueueStatus = {
  WAITING: "WAITING",
  RUNNING: "RUNNING",
  DONE: "DONE",
  MISSED: "MISSED",
  RECALLED: "RECALLED",
};

export const SubscriptionStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
};

export const SubscriptionTier = {
  GOLD: "GOLD",
  PLATINUM: "PLATINUM",
  DIAMOND: "DIAMOND",
};

export const BillingCycle = {
  MONTHLY: "MONTHLY",
  SIX_MONTHLY: "SIX_MONTHLY",
  YEARLY: "YEARLY",
};

export const PaymentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
};

export const InvoiceStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
};

export const RefundStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
};

export const CouponType = {
  PERCENTAGE: "PERCENTAGE",
  FIXED: "FIXED",
  FREE_TRIAL: "FREE_TRIAL",
};

export const PurchaseType = {
  NEW: "NEW",
  RENEWAL: "RENEWAL",
  UPGRADE: "UPGRADE",
};
