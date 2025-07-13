<script lang="ts">
  import { modalManager, type FormModalProps } from '$lib/stores/modalManager';
  import Modal from '../Modal.svelte';
  import { Eye, EyeOff } from 'lucide-svelte';

  let {
    id,
    fields,
    onSubmit,
    submitText = 'Submit',
    ...modalProps
  }: FormModalProps & { id: string } = $props();

  let isOpen = $state(true);
  let isLoading = $state(false);
  let formData = $state<Record<string, any>>({});
  let errors = $state<Record<string, string>>({});
  let showPassword = $state<Record<string, boolean>>({});

  // Initialize form data with default values
  $effect(() => {
    const initialData: Record<string, any> = {};
    const initialPasswordState: Record<string, boolean> = {};
    
    fields.forEach(field => {
      initialData[field.key] = '';
      if (field.type === 'password') {
        initialPasswordState[field.key] = false;
      }
    });
    
    formData = initialData;
    showPassword = initialPasswordState;
  });

  function validateField(field: any, value: any): string | null {
    // Required field validation
    if (field.required && (!value || value.toString().trim() === '')) {
      return `${field.label} is required`;
    }

    // Custom validation
    if (field.validation && value) {
      return field.validation(value);
    }

    // Built-in validations
    if (value && value.toString().trim() !== '') {
      switch (field.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            return 'Please enter a valid number';
          }
          break;
      }
    }

    return null;
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    fields.forEach(field => {
      const error = validateField(field, formData[field.key]);
      if (error) {
        newErrors[field.key] = error;
        isValid = false;
      }
    });

    errors = newErrors;
    return isValid;
  }

  function handleFieldChange(fieldKey: string, value: any) {
    formData[fieldKey] = value;
    
    // Clear error for this field when user starts typing
    if (errors[fieldKey]) {
      errors = { ...errors, [fieldKey]: '' };
    }
  }

  async function handleSubmit() {
    if (isLoading) return;

    if (!validateForm()) {
      return;
    }

    try {
      isLoading = true;
      
      if (onSubmit) {
        await onSubmit(formData);
      }
      
      modalManager.close(id, formData);
    } catch (error) {
      console.error('Form submission error:', error);
      // You might want to add global error handling here
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    modalManager.close(id, null);
  }

  function togglePasswordVisibility(fieldKey: string) {
    showPassword[fieldKey] = !showPassword[fieldKey];
  }

  function getInputType(field: any): string {
    if (field.type === 'password' && showPassword[field.key]) {
      return 'text';
    }
    return field.type;
  }
</script>

<Modal
  bind:isOpen
  onClose={handleCancel}
  width="520px"
  className="form-modal"
  {...modalProps}
>
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="flex flex-col gap-6 p-6">
    <!-- Form Fields -->
    <div class="space-y-4">
      {#each fields as field (field.key)}
        <div class="form-field">
          <label for={field.key} class="block text-sm font-medium text-kong-text-primary mb-2">
            {field.label}
            {#if field.required}
              <span class="text-red-500 ml-1">*</span>
            {/if}
          </label>
          
          <div class="relative">
            {#if field.type === 'textarea'}
              <textarea
                id={field.key}
                bind:value={formData[field.key]}
                oninput={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder || ''}
                rows="4"
                class="w-full px-3 py-2 rounded-lg border transition-colors duration-200 bg-kong-bg-secondary text-kong-text-primary placeholder-kong-text-tertiary focus:outline-none focus:ring-2 focus:ring-kong-accent-primary focus:border-transparent resize-vertical
                  {errors[field.key] ? 'border-red-500' : 'border-kong-border-primary'}"
              ></textarea>
            {:else}
              <input
                id={field.key}
                type={getInputType(field)}
                bind:value={formData[field.key]}
                oninput={(e) => handleFieldChange(field.key, e.target.value)}
                placeholder={field.placeholder || ''}
                class="w-full px-3 py-2 rounded-lg border transition-colors duration-200 bg-kong-bg-secondary text-kong-text-primary placeholder-kong-text-tertiary focus:outline-none focus:ring-2 focus:ring-kong-accent-primary focus:border-transparent
                  {errors[field.key] ? 'border-red-500' : 'border-kong-border-primary'}
                  {field.type === 'password' ? 'pr-10' : ''}"
              />
              
              {#if field.type === 'password'}
                <button
                  type="button"
                  onclick={() => togglePasswordVisibility(field.key)}
                  class="absolute right-3 top-1/2 transform -translate-y-1/2 text-kong-text-tertiary hover:text-kong-text-secondary transition-colors"
                >
                  {#if showPassword[field.key]}
                    <EyeOff size={18} />
                  {:else}
                    <Eye size={18} />
                  {/if}
                </button>
              {/if}
            {/if}
          </div>
          
          {#if errors[field.key]}
            <p class="text-red-500 text-sm mt-1">{errors[field.key]}</p>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-3 justify-end pt-4 border-t border-kong-border-primary">
      <button
        type="button"
        onclick={handleCancel}
        disabled={isLoading}
        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-kong-bg-secondary hover:bg-kong-bg-tertiary text-kong-text-secondary border border-kong-border-primary disabled:opacity-50"
      >
        Cancel
      </button>
      
      <button
        type="submit"
        disabled={isLoading}
        class="px-4 py-2 rounded-lg font-medium transition-colors duration-200 bg-kong-accent-primary hover:bg-kong-accent-secondary text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {#if isLoading}
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        {/if}
        {submitText}
      </button>
    </div>
  </form>
</Modal>

<style>
  :global(.form-modal .modal-content) {
    border-radius: 12px;
  }
  
  .form-field textarea {
    min-height: 100px;
  }
</style>