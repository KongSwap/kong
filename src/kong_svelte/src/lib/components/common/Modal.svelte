<script lang="ts">
    import { fade, scale } from 'svelte/transition';
    import Panel from '$lib/components/common/Panel.svelte';
    
    export let isOpen: boolean = false;
    export let onClose: () => void;
    export let title: string = '';
    export let width: string = 'auto';
    export let height: string = 'auto';
    
    function handleBackdropClick(event: MouseEvent) {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }
    </script>
    
    {#if isOpen}
    <div
      class="modal-backdrop font-play"
      on:click={handleBackdropClick}
      transition:fade={{ duration: 200 }}
    >
      <div class="modal-container" transition:scale={{ duration: 200, start: 0.95 }}>
        <Panel variant="green" type="s" {width} {height}>
          <div class="modal-content">
            <div class="modal-header">
              <h2>{title}</h2>
              <button class="close-button" on:click={onClose}>
                <svg viewBox="0 0 24 24" width="24" height="24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            <div class="modal-body">
              <slot />
            </div>
          </div>
        </Panel>
      </div>
    </div>
    {/if}
    
    <style>
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      }
    
      .modal-container {
        max-width: 100%;
        max-height: 90vh;
        overflow: auto;
      }
    
      .modal-content {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
    
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 1rem;
        border-bottom: 2px solid rgba(255, 255, 255, 0.1);
      }
    
      .modal-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: white;
        font-family: 'Press Start 2P', monospace;
      }
    
      .close-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
        color: white;
        opacity: 0.8;
        transition: opacity 0.2s;
      }
    
      .close-button:hover {
        opacity: 1;
      }
    
      .modal-body {
        overflow-y: auto;
      }
    </style>
