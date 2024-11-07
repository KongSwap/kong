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

export const formatToNonZeroDecimal = (number: number | string): string => {
  const num = typeof number === 'string' ? parseFloat(number) : number;

  // If the number is less than 0.01, format with more decimal places
  if (num < 0.01 && num > 0) {
    const numberStr = num.toString();
    const decimalPart = numberStr.split('.')[1] || '';
    
    // Find the first non-zero index in the decimal part
    const firstNonZeroIndex = decimalPart.search(/[1-9]/) + 2;

    // If a non-zero digit is found, format accordingly
    if (firstNonZeroIndex !== -1) {
      return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: firstNonZeroIndex,
        maximumFractionDigits: firstNonZeroIndex
      }).format(num);
    }
  }

  // Default formatting for numbers >= 0.01
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export const formatTokenAmount = (amount: bigint | number | string, decimals: number): number => {
  const amountNumber = Number(amount);
  return amountNumber / Math.pow(10, decimals);
};

export const parseTokenAmount = (formattedAmount: number | string, decimals: number): bigint => {
  const amountNumber = Number(formattedAmount);
  return BigInt(Math.round(amountNumber * Math.pow(10, decimals)));
};
