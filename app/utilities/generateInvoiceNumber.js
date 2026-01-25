// Generate unique invoice number
export const generateInvoiceNumber = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  return `INV-${year}${month}-${random}-${timestamp}`;
};
