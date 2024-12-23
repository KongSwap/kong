export function handleFormattedNumberInput(
    value: string,
    cursorPosition: number,
    previousValue: string
): {
    rawValue: string;
    formattedValue: string;
    newCursorPosition: number;
} {
    // Remove existing commas
    let rawValue = value.replace(/,/g, '');
    
    if (rawValue === '' || !isValidNumber(rawValue)) {
        return {
            rawValue: '0',
            formattedValue: '',
            newCursorPosition: cursorPosition
        };
    }

    // Handle empty values or just decimal point
    if (!rawValue || rawValue === '.') {
        return {
            rawValue: '0',
            formattedValue: '',
            newCursorPosition: 0
        };
    }

    const formattedValue = formatWithCommas(rawValue);
    
    // Calculate new cursor position
    const beforeCursor = formattedValue.slice(0, cursorPosition);
    const commasBeforeCursor = (beforeCursor.match(/,/g) || []).length;
    const commasInOriginal = (previousValue.slice(0, cursorPosition).match(/,/g) || []).length;
    const commaDiff = commasBeforeCursor - commasInOriginal;
    
    return {
        rawValue,
        formattedValue,
        newCursorPosition: cursorPosition + commaDiff
    };
}

export function isValidNumber(value: string): boolean {
    return /^\d*\.?\d*$/.test(value);
}

export function formatWithCommas(value: string): string {
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

export interface InputState {
    element: HTMLInputElement | null;
    focused: boolean;
    displayValue: string;
}

export function createInputState(): InputState {
    return {
        element: null,
        focused: false,
        displayValue: ""
    };
}

export function handleInputBlur(state: InputState) {
    state.focused = false;
}

export function validateAndCleanInput(
    value: string,
    maxDecimals: number,
    defaultValue: string = "0"
): string {
    // Remove commas and underscores
    let cleanValue = value.replace(/[,_]/g, "");

    if (!isValidNumber(cleanValue)) {
        return defaultValue;
    }

    // Handle decimal point
    if (cleanValue.includes(".")) {
        const [whole, decimal] = cleanValue.split(".");
        cleanValue = `${whole}.${decimal.slice(0, maxDecimals)}`;
    }

    // Remove leading zeros unless it's "0." or just "0"
    if (cleanValue.length > 1 && cleanValue.startsWith("0") && cleanValue[1] !== ".") {
        cleanValue = cleanValue.replace(/^0+/, "");
    }

    // If empty or invalid after processing, set to default
    if (!cleanValue || cleanValue === ".") {
        cleanValue = defaultValue;
    }

    return cleanValue;
} 