import cron from "node-cron";
import { prisma } from "../lib/prisma.js";

const otpCleanup = () => {
  // Schedule: every Sunday at 1:00 AM server time
  cron.schedule("0 1 * * 0", async () => {
    console.log("🧹 Starting OTP cleanup...");

    try {
      const deletedCount = await prisma.$transaction(async (tx) => {
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const result = await tx.otpVerification.deleteMany({
          where: {
            otp_expiry: {
              lt: twoDaysAgo, // keep otp for last 2 days
            },
          },
        });

        return result;
      });
      console.log(`🧹 Deleted ${deletedCount.count} expired OTP(s) on Sunday.`);
    } catch (error) {
      console.error("❌ OTP cleanup failed:", error);
    }
  });
};

export default otpCleanup;
