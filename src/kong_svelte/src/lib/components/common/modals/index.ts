// Core modal system exports
export { default as Modal } from '../Modal.svelte';
export { default as ModalRenderer } from './ModalRenderer.svelte';

// Modal pattern components
export { default as ConfirmationModal } from './ConfirmationModal.svelte';
export { default as FormModal } from './FormModal.svelte';
export { default as SelectorModal } from './SelectorModal.svelte';
export { default as SignatureModal } from './SignatureModal.svelte';
export { default as QRModal } from './QRModal.svelte';
export { default as CustomModal } from './CustomModal.svelte';

// Modal management
export { 
  modalManager, 
  modals,
  type ModalType,
  type ModalProps,
  type ModalState,
  type ConfirmationModalProps,
  type FormModalProps,
  type SelectorModalProps,
  type SignatureModalProps,
  type QRModalProps,
  type CustomModalProps
} from '$lib/stores/modalManager';

// Modal factory
export { 
  modalFactory,
  createModalFactory,
  confirmations,
  forms,
  selectors,
  wallet,
  swap,
  prediction
} from '$lib/services/modalFactory';

// Legacy compatibility (will be deprecated)
export { modalStack } from '$lib/stores/modalStore';
export { signatureModalStore } from '$lib/stores/signatureModalStore';
export { qrModalStore } from '$lib/stores/qrModalStore';