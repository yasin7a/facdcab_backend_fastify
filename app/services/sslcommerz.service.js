// SSLCommerz Service
import SSLCommerzPayment from "sslcommerz-lts";
import serverConfig from "../../config/server.config.js";

class SSLCommerzService {
  constructor() {
    this.store_id = process.env.SSLCOMMERZ_STORE_ID || "asdas6971c45b4de59";
    this.store_passwd =
      process.env.SSLCOMMERZ_STORE_PASSWORD || "asdas6971c45b4de59@ssl";
    this.is_live = process.env.SSLCOMMERZ_IS_LIVE === "true" ? true : false;

    this.sslcommerz = new SSLCommerzPayment(
      this.store_id,
      this.store_passwd,
      this.is_live,
    );
  }

  /**
   * Initiate payment with SSLCommerz
   */
  async initiatePayment({ invoice, user, payment_method }) {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    const data = {
      total_amount: parseFloat(invoice.amount),
      currency: invoice.currency || "BDT",
      tran_id: `TXN_${invoice.id}_${Date.now()}`, // Unique transaction ID
      success_url: `${baseUrl}/api/payments/sslcommerz/success`,
      fail_url: `${baseUrl}/api/payments/sslcommerz/fail`,
      cancel_url: `${baseUrl}/api/payments/sslcommerz/cancel`,
      ipn_url: `${baseUrl}/api/payments/sslcommerz/ipn`, // For instant payment notification
      shipping_method: "NO",
      product_name: invoice.description || "Subscription Payment",
      product_category: invoice.purchase_type,
      product_profile: "general",

      // Customer information
      cus_name:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Customer",
      cus_email: user.email,
      cus_add1: "N/A",
      cus_city: "N/A",
      cus_state: "N/A",
      cus_postcode: "N/A",
      cus_country: "Bangladesh",
      cus_phone: user.phone_number || "N/A",

      // Shipping information (same as billing)
      ship_name:
        `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Customer",
      ship_add1: "N/A",
      ship_city: "N/A",
      ship_state: "N/A",
      ship_postcode: "N/A",
      ship_country: "Bangladesh",

      // Additional info
      value_a: invoice.id.toString(), // Invoice ID
      value_b: user.id.toString(), // User ID
      value_c: payment_method, // Payment method preference
    };

    try {
      const response = await this.sslcommerz.init(data);

      if (response.status === "SUCCESS") {
        return {
          status: "SUCCESS",
          sessionkey: response.sessionkey,
          GatewayPageURL: response.GatewayPageURL,
          ...response,
        };
      } else {
        throw new Error(response.failedreason || "Payment initiation failed");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate transaction with SSLCommerz
   */
  async validateTransaction(val_id) {
    try {
      const response = await this.sslcommerz.validate({ val_id });
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transaction query by transaction ID
   */
  async transactionQueryByTranId(tran_id) {
    try {
      const response = await this.sslcommerz.transactionQueryByTransactionId({
        tran_id,
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transaction query by session key
   */
  async transactionQueryBySessionkey(sessionkey) {
    try {
      const response = await this.sslcommerz.transactionQueryBySessionkey({
        sessionkey,
      });
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initiate refund
   */
  async initiateRefund({ bank_tran_id, refund_amount, refund_remarks }) {
    try {
      const data = {
        refund_amount: parseFloat(refund_amount),
        refund_remarks: refund_remarks || "Refund request",
        bank_tran_id,
        refe_id: `REF_${Date.now()}`,
      };

      const response = await this.sslcommerz.initiateRefund(data);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Refund query
   */
  async refundQuery(refund_ref_id) {
    try {
      const response = await this.sslcommerz.refundQuery({
        refund_ref_id,
      });
      return response;
    } catch (error) {
      throw error;
    }
  }
}

export default SSLCommerzService;
