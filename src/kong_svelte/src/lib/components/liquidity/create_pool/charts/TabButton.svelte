<script lang="ts">
  export let active: boolean;
  export let label: string;
</script>

<button
  class="text-base font-semibold pb-2 relative {active ? 'text-indigo-600' : 'text-gray-400'} hover:text-indigo-600 transition-colors"
>
  {label}
</button> 