<div class="flex flex-col h-full">
  <!-- Table container with flex-1 to take remaining space -->
  <div class="flex-1 overflow-auto">
    <table class="w-full">
      <!-- ... table header and body ... -->
    </table>
  </div>
  
  <!-- Pagination footer with fixed height -->
  {#if showPagination}
    <div class="border-t border-kong-border mt-auto">
      <!-- ... pagination controls ... -->
    </div>
  {/if}
</div> 