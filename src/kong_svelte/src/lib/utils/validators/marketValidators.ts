export interface MarketFormState {
  question: string;
  category: string;
  rules: string;
  outcomes: string[];
  resolutionMethod: string;
  endTimeType: "Duration" | "SpecificDate";
  duration: number;
  specificDate: string;
  specificTime: string;
}

/**
 * Validate the market creation form for the given step.
 * Returns a map of field names to error messages.
 */
export function validateMarketFormStep(
  formState: MarketFormState,
  currentStep: number
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (currentStep === 1) {
    if (!formState.question.trim()) {
      errors.question = "Question is required";
    }
    if (!formState.rules.trim()) {
      errors.rules = "Rules are required";
    }
  } else if (currentStep === 2) {
    if (formState.outcomes.some(o => !o.trim())) {
      errors.outcomes = "All outcomes must be filled";
    }
  } else if (currentStep === 3) {
    if (formState.endTimeType === "Duration") {
      if (!formState.duration || formState.duration < 1) {
        errors.duration = "Duration must be at least 1 hour";
      }
    } else {
      if (!formState.specificDate || !formState.specificTime) {
        errors.specificDate = "Date and time are required";
      } else {
        const selectedDateTime = new Date(`${formState.specificDate}T${formState.specificTime}`);
        if (selectedDateTime <= new Date()) {
          errors.specificDate = "End time must be in the future";
        }
      }
    }
  }

  return errors;
} 