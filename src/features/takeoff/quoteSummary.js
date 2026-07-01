import { getFinalOptionTotal } from "./quoteMath.js";

export function selectPrimaryQuoteOption(quoteOpts = []) {
  return quoteOpts.find((option) => (option.items || []).length > 0) || quoteOpts[0] || null;
}

export function buildQuoteSummary({
  customer = {},
  quoteOpts = [],
  salesman = "",
  sourceTakeoffJobId = null,
  jobName = "",
  now = () => new Date().toISOString(),
} = {}) {
  const option = selectPrimaryQuoteOption(quoteOpts);
  const timestamp = now();
  const quoteOptsSummary = quoteOpts.map((quoteOption) => ({
    optionName: quoteOption.name || "Option",
    totalPrice: getFinalOptionTotal(quoteOption),
    itemCount: (quoteOption.items || []).length,
    hasPsoCredit: Boolean(quoteOption.pso || quoteOption.psoKw),
  }));

  return {
    customerName: customer.name || jobName || "",
    address: customer.address || "",
    jobAddress: customer.jobAddress || customer.address || "",
    phone: customer.phone || "",
    email: customer.email || "",
    salesman,
    totalPrice: option ? getFinalOptionTotal(option) : 0,
    optionName: option?.name || "",
    status: "quoted",
    sourceTakeoffJobId,
    sourceTakeoffJobName: jobName || null,
    quoteOptsSummary,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
