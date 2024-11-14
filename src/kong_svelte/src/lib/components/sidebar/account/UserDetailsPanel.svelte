<script lang="ts">
  import { fly } from "svelte/transition";
  import { userStore } from "$lib/services/wallet/walletStore";
  
  $: userDetails = $userStore ? JSON.stringify($userStore, null, 2) : 'No user data';
</script>

<div class="tab-panel">
  <div class="detail-section">
    <h3>User Details</h3>
    <div class="user-details-container">
      <div class="user-details-wrapper">
        <pre class="user-details">{userDetails}</pre>
      </div>
    </div>
  </div>
</div>

<style>
  .detail-section {
    padding-bottom: 1rem;
  }

  .detail-section h3 {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .user-details-container {
    width: 100%;
    max-width: 100%;
    margin-top: 0.5rem;
  }

  .user-details-wrapper {
    margin-top: 0.5rem;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .user-details-wrapper::-webkit-scrollbar {
    height: 8px;
  }

  .user-details-wrapper::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
  }

  .user-details {
    padding: 0.75rem;
    margin: 0;
    background: none;
    border: none;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: monospace;
    font-size: 0.75rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.9);
    width: 100%;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style> 
