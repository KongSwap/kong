export const formatNumberCustom = (number, maxDecimals) => {
  if (number === undefined || number === null) {
    return "0";
  }
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

export const formatTokenBalance = (balance = "0", decimals: number): string => {
  // Convert the balance to a string and pad with zeros if necessary
  const balanceStr = balance.toString().padStart(decimals + 1, '0');
  
  // Insert the decimal point at the correct position
  let integerPart = balanceStr.slice(0, -decimals) || '0';
  let fractionalPart = balanceStr.slice(-decimals).padEnd(2, '0');

  // Add commas to the integer part
  integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Ensure at least two decimal places
  const paddedFractionalPart = fractionalPart.padEnd(2, '0');

  // Return the formatted balance with commas and at least two decimal places
  return `${integerPart}.${paddedFractionalPart}`;
};

export const formatUSD = (number: number | string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(number));
};

export const formatTokenAmount = (amount: bigint | number, decimals: number): number => {
  return Number(amount) / Math.pow(10, decimals);
};
