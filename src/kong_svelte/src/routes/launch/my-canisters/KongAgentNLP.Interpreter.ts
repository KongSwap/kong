/**
 * Lightweight Interpreter for Kong Agent NLP
 * Optimized for Internet Computer Platform with minimal size
 */

/**
 * Types of values that can be stored in memory
 */
export type ValueType = string | number | boolean | null | ValueType[] | Record<string, ValueType>;

/**
 * Simplified interpreter for Kong Agent
 * Provides a memory system without external dependencies
 */
export class Interpreter {
  private memory: Record<string, ValueType>;
  private functionRegistry: Record<string, (...args: any[]) => any>;
  
  /**
   * Initialize a new interpreter instance
   */
  constructor() {
    this.memory = {};
    this.functionRegistry = {};
    
    // Register basic functions
    this.registerCoreFunctions();
  }
  
  /**
   * Register core functions for basic operations
   */
  private registerCoreFunctions() {
    // String operations
    this.registerFunction('concat', (...args: any[]) => args.join(''));
    this.registerFunction('lowercase', (str: string) => String(str).toLowerCase());
    this.registerFunction('uppercase', (str: string) => String(str).toUpperCase());
    this.registerFunction('trim', (str: string) => String(str).trim());
    
    // Math operations
    this.registerFunction('add', (a: number, b: number) => a + b);
    this.registerFunction('subtract', (a: number, b: number) => a - b);
    this.registerFunction('multiply', (a: number, b: number) => a * b);
    this.registerFunction('divide', (a: number, b: number) => a / b);
    
    // Logic operations
    this.registerFunction('equals', (a: any, b: any) => a === b);
    this.registerFunction('not', (a: boolean) => !a);
    this.registerFunction('and', (a: boolean, b: boolean) => a && b);
    this.registerFunction('or', (a: boolean, b: boolean) => a || b);
    
    // Utility
    this.registerFunction('print', (message: string) => message);
    this.registerFunction('typeof', (value: any) => typeof value);
    this.registerFunction('if', (condition: boolean, trueValue: any, falseValue: any) => 
      condition ? trueValue : falseValue
    );
  }
  
  /**
   * Register a custom function
   */
  registerFunction(name: string, fn: (...args: any[]) => any): void {
    this.functionRegistry[name] = fn;
  }
  
  /**
   * Reset the interpreter's memory
   */
  reset(): void {
    this.memory = {};
  }
  
  /**
   * Set a variable in memory
   */
  setVariable(name: string, value: ValueType): void {
    this.memory[name] = value;
  }
  
  /**
   * Get a variable from memory
   */
  getVariable(name: string): ValueType | undefined {
    return this.memory[name];
  }
  
  /**
   * Check if a variable exists in memory
   */
  hasVariable(name: string): boolean {
    return this.memory.hasOwnProperty(name);
  }
  
  /**
   * Evaluate a function call
   */
  evaluate(functionName: string, args: any[]): any {
    if (!this.functionRegistry[functionName]) {
      throw new Error(`Function not found: ${functionName}`);
    }
    
    const resolvedArgs = args.map(arg => {
      if (typeof arg === 'string' && arg.startsWith('$') && this.hasVariable(arg.substring(1))) {
        return this.getVariable(arg.substring(1));
      }
      return arg;
    });
    
    return this.functionRegistry[functionName](...resolvedArgs);
  }
  
  /**
   * Process an intent using a script structure
   * This is a simplified version without complex parsing
   */
  processIntent(intent: any, variables: Record<string, any>): void {
    // Store intent information in memory
    this.setVariable('intent', intent.intent);
    
    // Store all variables
    for (const [key, value] of Object.entries(variables)) {
      this.setVariable(key, value);
    }
  }
  
  /**
   * Get a snapshot of the current memory state
   */
  getMemoryDump(): Record<string, ValueType> {
    return { ...this.memory };
  }
  
  /**
   * Determine the type of a value
   */
  getValueType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
} 
