import otpCleanup from "./otpCleanup.js";
import subscriptionCronJobs from "./subscriptionCron.js";

const runJobs = async () => {
  otpCleanup();
  subscriptionCronJobs();
};
export default runJobs;
