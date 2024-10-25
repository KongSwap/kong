<script lang="ts">
import { backend } from "$lib/canisters";
import { onMount } from "svelte";
import { t } from "$lib/translations"; // Ensure this is a store

let tokens: any = [];

onMount(async () => {
  tokens = await backend.tokens([""]);
  console.log(tokens);
});
</script>

<main class="flex flex-col">
  <p>
    {$t("common.greeting")}, {$t("common.welcome")}
  </p>
  {#each tokens.Ok as token}
    <div class="text-sm uppercase text-gray-500">{token?.IC?.name}</div>
  {/each}
</main>
