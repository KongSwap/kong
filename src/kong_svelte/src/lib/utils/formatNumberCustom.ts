export const formatNumberCustom = (number, maxDecimals) => {
  const parts = number.toString().split(".");
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (maxDecimals > 0) {
    const decimalPart = (parts[1] || "")
      .padEnd(maxDecimals, "0")
      .substring(0, maxDecimals);
    return `${integerPart}.${decimalPart}`;
  } else {
    return integerPart;
  }
}; 

export const getTokenDecimals = (symbol) => {
  // Implement logic to get token decimals
  return 6;
};