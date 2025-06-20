<script lang="ts">
  interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }

  let { currentPage, totalPages, onPageChange }: PaginationProps = $props();

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages = [];
    if (currentPage <= 4) {
      for (let i = 1; i <= 7; i++) pages.push(i);
    } else if (currentPage >= totalPages - 3) {
      for (let i = totalPages - 6; i <= totalPages; i++) pages.push(i);
    } else {
      for (let i = currentPage - 3; i <= currentPage + 3; i++) pages.push(i);
    }
    
    return pages.filter(p => p > 0 && p <= totalPages);
  };
</script>

{#if totalPages > 1}
  <div class="mt-6 flex justify-center items-center gap-2">
    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {currentPage === 1
        ? 'ext-gray-500 cursor-not-allowed'
        : 'bg-white/[0.05] text-kong-text-primary hover:bg-white/[0.08]'}"
      onclick={() => onPageChange(currentPage - 1)}
      disabled={currentPage === 1}
    >
      Previous
    </button>

    <div class="flex items-center gap-1">
      {#each getPageNumbers() as pageNum}
        <button
          class="w-10 h-10 rounded-lg text-sm font-medium transition-all duration-200 {pageNum === currentPage
            ? 'bg-kong-primary text-white'
            : 'bg-white/[0.05] text-kong-text-primary hover:bg-white/[0.08]'}"
          onclick={() => onPageChange(pageNum)}
        >
          {pageNum}
        </button>
      {/each}
    </div>

    <button
      class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 {currentPage === totalPages
        ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'bg-white/[0.05] text-kong-text-primary hover:bg-white/[0.08]'}"
      onclick={() => onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>
{/if}