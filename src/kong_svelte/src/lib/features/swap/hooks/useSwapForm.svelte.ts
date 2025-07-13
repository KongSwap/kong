import type { SwapFormValues, SwapFormErrors, SwapToken } from '../types/swap.types';
import { SwapValidator } from '../services/SwapValidator';
import BigNumber from 'bignumber.js';
import { get } from 'svelte/store';
import { currentUserBalancesStore } from '$lib/stores/balancesStore';
import { auth } from '$lib/stores/auth';

export interface UseSwapFormReturn {
  values: SwapFormValues;
  errors: SwapFormErrors;
  isValid: boolean;
  isDirty: boolean;
  setPayToken: (token: SwapToken | null) => void;
  setReceiveToken: (token: SwapToken | null) => void;
  setPayAmount: (amount: string, needsAllowance?: boolean) => void;
  setReceiveAmount: (amount: string) => void;
  switchTokens: () => void;
  validateForm: () => Promise<boolean>;
  reset: () => void;
}

export function useSwapForm(): UseSwapFormReturn {
  const validator = new SwapValidator();
  
  // Form state using runes
  let values = $state<SwapFormValues>({
    payToken: null,
    payAmount: '',
    receiveToken: null,
    receiveAmount: '',
  });
  
  let errors = $state<SwapFormErrors>({});
  let isDirty = $state(false);
  
  // Derived state
  let isValid = $derived(
    !!(
      values.payToken &&
      values.receiveToken &&
      values.payAmount &&
      parseFloat(values.payAmount) > 0 &&
      Object.keys(errors).length === 0
    )
  );
  
  // Validate amount format
  const validateAmount = (amount: string, token: SwapToken | null): string | undefined => {
    if (!amount) return undefined;
    
    try {
      const bn = new BigNumber(amount);
      
      if (!bn.isFinite()) {
        return 'Invalid number';
      }
      
      if (bn.isNegative()) {
        return 'Amount must be positive';
      }
      
      if (bn.isZero()) {
        return 'Amount must be greater than 0';
      }
      
      // Check decimal places
      if (token) {
        const parts = amount.split('.');
        if (parts.length > 1 && parts[1].length > token.decimals) {
          return `Maximum ${token.decimals} decimal places allowed`;
        }
      }
      
      return undefined;
    } catch {
      return 'Invalid amount';
    }
  };
  
  // Validate balance sufficiency
  const validateBalance = (amount: string, token: SwapToken | null, needsAllowance: boolean = false): string | undefined => {
    if (!amount || !token || !get(auth).isConnected) return undefined;
    
    try {
      const balances = get(currentUserBalancesStore);
      const tokenBalance = balances?.[token.address];
      
      if (!tokenBalance) {
        return 'Balance not loaded';
      }
      
      const balanceBN = new BigNumber(tokenBalance.in_tokens.toString())
        .div(new BigNumber(10).pow(token.decimals));
      const amountBN = new BigNumber(amount);
      
      // Calculate fees if ICRC-2 token
      let totalRequired = amountBN;
      if (token.standards?.includes('ICRC-2')) {
        const feeInTokens = new BigNumber(token.fee_fixed || '10000')
          .div(new BigNumber(10).pow(token.decimals));
        
        // Add approval fee if needed
        if (needsAllowance) {
          totalRequired = amountBN.plus(feeInTokens.times(2)); // One for approval, one for transfer
        } else {
          totalRequired = amountBN.plus(feeInTokens); // Just transfer fee
        }
      }
      
      if (balanceBN.lt(amountBN)) {
        return 'Insufficient balance';
      }
      
      if (balanceBN.lt(totalRequired)) {
        return 'Insufficient balance for fees';
      }
      
      // Warning if using entire balance
      if (balanceBN.eq(amountBN)) {
        return 'Warning: Using entire balance';
      }
      
      return undefined;
    } catch (error) {
      console.error('Balance validation error:', error);
      return undefined;
    }
  };
  
  // Set pay token
  const setPayToken = (token: SwapToken | null) => {
    // Clear receive token if same as pay token
    if (token && values.receiveToken?.address === token.address) {
      values = { ...values, payToken: token, receiveToken: null };
    } else {
      values = { ...values, payToken: token };
    }
    
    isDirty = true;
    validateField('payToken');
  };
  
  // Set receive token
  const setReceiveToken = (token: SwapToken | null) => {
    // Clear pay token if same as receive token
    if (token && values.payToken?.address === token.address) {
      values = { ...values, receiveToken: token, payToken: null };
    } else {
      values = { ...values, receiveToken: token };
    }
    
    isDirty = true;
    validateField('receiveToken');
  };
  
  // Set pay amount
  const setPayAmount = (amount: string, needsAllowance: boolean = false) => {
    // Clean input - remove invalid characters
    const cleanAmount = amount.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanAmount.split('.');
    const formattedAmount = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : cleanAmount;
    
    // Ensure reactive update in Svelte 5
    values = { 
      payToken: values.payToken,
      payAmount: formattedAmount,
      receiveToken: values.receiveToken,
      receiveAmount: values.receiveAmount
    };
    isDirty = true;
    
    // Validate format first
    const formatError = validateAmount(formattedAmount, values.payToken);
    
    // Then validate balance if format is valid
    const balanceError = !formatError ? validateBalance(formattedAmount, values.payToken, needsAllowance) : undefined;
    
    if (formatError) {
      errors = { ...errors, payAmount: formatError };
    } else if (balanceError) {
      errors = { ...errors, payAmount: balanceError };
    } else {
      const { payAmount, ...rest } = errors;
      errors = rest;
    }
  };
  
  // Set receive amount
  const setReceiveAmount = (amount: string) => {
    // Clean input - remove invalid characters
    const cleanAmount = amount.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = cleanAmount.split('.');
    const formattedAmount = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : cleanAmount;
    
    values = { ...values, receiveAmount: formattedAmount };
    isDirty = true;
    
    const error = validateAmount(formattedAmount, values.receiveToken);
    
    if (error) {
      errors = { ...errors, receiveAmount: error };
    } else {
      const { receiveAmount, ...rest } = errors;
      errors = rest;
    }
  };
  
  // Switch tokens
  const switchTokens = () => {
    values = {
      payToken: values.receiveToken,
      payAmount: values.receiveAmount || values.payAmount,
      receiveToken: values.payToken,
      receiveAmount: '',
    };
    
    isDirty = true;
    validateForm();
  };
  
  // Validate specific field
  const validateField = (field: keyof SwapFormValues) => {
    const newErrors = { ...errors };
    
    switch (field) {
      case 'payToken':
        if (!values.payToken) {
          newErrors.payToken = 'Please select a token to send';
        } else if (values.payToken.address === values.receiveToken?.address) {
          newErrors.payToken = 'Cannot swap the same token';
        } else {
          delete newErrors.payToken;
        }
        break;
        
      case 'receiveToken':
        if (!values.receiveToken) {
          newErrors.receiveToken = 'Please select a token to receive';
        } else if (values.receiveToken.address === values.payToken?.address) {
          newErrors.receiveToken = 'Cannot swap the same token';
        } else {
          delete newErrors.receiveToken;
        }
        break;
        
      case 'payAmount':
        const payError = validateAmount(values.payAmount, values.payToken);
        if (payError) {
          newErrors.payAmount = payError;
        } else {
          delete newErrors.payAmount;
        }
        break;
        
      case 'receiveAmount':
        const receiveError = validateAmount(values.receiveAmount, values.receiveToken);
        if (receiveError) {
          newErrors.receiveAmount = receiveError;
        } else {
          delete newErrors.receiveAmount;
        }
        break;
    }
    
    errors = newErrors;
  };
  
  // Validate entire form
  const validateForm = async (): Promise<boolean> => {
    const newErrors: SwapFormErrors = {};
    
    // Validate tokens
    if (!values.payToken) {
      newErrors.payToken = 'Please select a token to send';
    }
    
    if (!values.receiveToken) {
      newErrors.receiveToken = 'Please select a token to receive';
    }
    
    if (values.payToken && values.receiveToken && 
        values.payToken.address === values.receiveToken.address) {
      newErrors.general = 'Cannot swap the same token';
    }
    
    // Validate amounts
    const payError = validateAmount(values.payAmount, values.payToken);
    if (payError) {
      newErrors.payAmount = payError;
    }
    
    // Use validator for comprehensive validation if all basic checks pass
    if (Object.keys(newErrors).length === 0 && 
        values.payToken && 
        values.receiveToken && 
        values.payAmount) {
      
      const validationResult = await validator.validate({
        payToken: values.payToken,
        receiveToken: values.receiveToken,
        payAmount: values.payAmount,
        slippage: 1, // Default slippage for validation
      });
      
      if (!validationResult.isValid && validationResult.errors) {
        newErrors.general = validationResult.errors.join('. ');
      }
    }
    
    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  };
  
  // Reset form
  const reset = () => {
    values = {
      payToken: null,
      payAmount: '',
      receiveToken: null,
      receiveAmount: '',
    };
    errors = {};
    isDirty = false;
  };
  
  return {
    get values() { return values; },
    get errors() { return errors; },
    get isValid() { return isValid; },
    get isDirty() { return isDirty; },
    setPayToken,
    setReceiveToken,
    setPayAmount,
    setReceiveAmount,
    switchTokens,
    validateForm,
    reset,
  };
}