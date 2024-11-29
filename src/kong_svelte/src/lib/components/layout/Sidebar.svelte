<script>
    // ... other imports
    import TransactionHistory from '../sidebar/TransactionHistory.svelte';
</script>

<!-- Add this to your sidebar tabs -->
<div class="tab-content" class:active={activeTab === 'history'}>
    <TransactionHistory />
</div> 
