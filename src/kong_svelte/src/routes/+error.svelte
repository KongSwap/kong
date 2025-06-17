<script>
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import "../app.css";
</script>

<section class="w-screen h-screen flex items-center justify-center">
  <div
    class="flex flex-col items-center justify-center min-h-[100vh] text-center"
  >
    <h1 class="text-7xl font-bold mb-4">Oops!</h1>
    <h2 class="text-2xl font-bold mb-4">
      You've encountered a <span class="text-kong-error"
        >{$page.status}</span
      > error.
    </h2>
    <p class="mb-8 max-w-lg">
      Please check the URL and try again. If the URL is valid and the problem
      persists, please contact support.
    </p>
    <ButtonV2
      label="Back to Swap"
      theme="primary"
      variant="solid"
      size="md"
      onclick={() => {
        goto("/swap");
      }}
    />
  </div>
</section>
