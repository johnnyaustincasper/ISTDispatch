export function getOptionLineItemsTotal(option) {
  return (option.items || []).reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
}

export function getPsoCredit(option) {
  return (option.pso ? 600 : 0) + (option.psoKw ? 525 : 0);
}

export function getOptionAdjustmentsTotal(option) {
  const extraLabor = option.extraLabor ? (parseFloat(option.extraLaborAmt) || 0) : 0;
  const tripCharge = option.tripCharge ? (parseFloat(option.tripChargeAmt) || 0) : 0;
  const energySeal = option.energySeal ? (parseFloat(option.energySealAmt) || 0) : 0;
  const dumpster = option.dumpster ? (parseFloat(option.dumpsterAmt) || 0) : 0;
  const customItems = (option.customItems || []).reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  return extraLabor + tripCharge + energySeal + dumpster + customItems;
}

export function getCalculatedOptionTotal(option) {
  return getOptionLineItemsTotal(option) - getPsoCredit(option) + getOptionAdjustmentsTotal(option);
}

export function getFinalOptionTotal(option) {
  return option.overrideTotal !== "" && option.overrideTotal != null
    ? (parseFloat(option.overrideTotal) || 0)
    : getCalculatedOptionTotal(option);
}
