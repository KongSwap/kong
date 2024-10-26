<script lang="ts">
  export let variant: "primary" | "secondary" | "danger" = "primary";
  export let size: "small" | "medium" | "large" = "medium";
  export let disabled: boolean = false;
  export let onClick: () => void = () => {};
</script>

<button
  class={`pixel-corners px-3 py-2.5 ${variant} ${size} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
  on:click={onClick}
  {disabled}
>
  <slot>Test</slot>
</button>

<style scoped lang="postcss">
  .primary {
    @apply bg-[#61c9ff] hover:bg-[#00a1fa];
    @apply uppercase hover:text-white font-extrabold;
  }

  .pixel-corners,
.pixel-corners--wrapper {
  clip-path: polygon(0px calc(100% - 14px),
    2px calc(100% - 14px),
    2px calc(100% - 10px),
    4px calc(100% - 10px),
    4px calc(100% - 6px),
    6px calc(100% - 6px),
    6px calc(100% - 4px),
    10px calc(100% - 4px),
    10px calc(100% - 2px),
    14px calc(100% - 2px),
    14px 100%,
    calc(100% - 14px) 100%,
    calc(100% - 14px) calc(100% - 2px),
    calc(100% - 10px) calc(100% - 2px),
    calc(100% - 10px) calc(100% - 4px),
    calc(100% - 6px) calc(100% - 4px),
    calc(100% - 6px) calc(100% - 6px),
    calc(100% - 4px) calc(100% - 6px),
    calc(100% - 4px) calc(100% - 10px),
    calc(100% - 2px) calc(100% - 10px),
    calc(100% - 2px) calc(100% - 14px),
    100% calc(100% - 14px),
    100% 14px,
    calc(100% - 2px) 14px,
    calc(100% - 2px) 10px,
    calc(100% - 4px) 10px,
    calc(100% - 4px) 6px,
    calc(100% - 6px) 6px,
    calc(100% - 6px) 4px,
    calc(100% - 10px) 4px,
    calc(100% - 10px) 2px,
    calc(100% - 14px) 2px,
    calc(100% - 14px) 0px,
    14px 0px,
    14px 2px,
    10px 2px,
    10px 4px,
    6px 4px,
    6px 6px,
    4px 6px,
    4px 10px,
    2px 10px,
    2px 14px,
    0px 14px);
  position: relative;
}
.pixel-corners {
  border: 2px solid transparent;
}
.pixel-corners--wrapper {
  width: fit-content;
  height: fit-content;
}
.pixel-corners--wrapper .pixel-corners {
  display: block;
  clip-path: polygon(2px 14px,
    4px 14px,
    4px 10px,
    6px 10px,
    6px 6px,
    10px 6px,
    10px 4px,
    14px 4px,
    14px 2px,
    calc(100% - 14px) 2px,
    calc(100% - 14px) 4px,
    calc(100% - 10px) 4px,
    calc(100% - 10px) 6px,
    calc(100% - 6px) 6px,
    calc(100% - 6px) 10px,
    calc(100% - 4px) 10px,
    calc(100% - 4px) 14px,
    calc(100% - 2px) 14px,
    calc(100% - 2px) calc(100% - 14px),
    calc(100% - 4px) calc(100% - 14px),
    calc(100% - 4px) calc(100% - 10px),
    calc(100% - 6px) calc(100% - 10px),
    calc(100% - 6px) calc(100% - 6px),
    calc(100% - 10px) calc(100% - 6px),
    calc(100% - 10px) calc(100% - 4px),
    calc(100% - 14px) calc(100% - 4px),
    calc(100% - 14px) calc(100% - 2px),
    14px calc(100% - 2px),
    14px calc(100% - 4px),
    10px calc(100% - 4px),
    10px calc(100% - 6px),
    6px calc(100% - 6px),
    6px calc(100% - 10px),
    4px calc(100% - 10px),
    4px calc(100% - 14px),
    2px calc(100% - 14px));
}
.pixel-corners::after,
.pixel-corners--wrapper::after {
  content: "";
  position: absolute;
  clip-path: polygon(0px calc(100% - 14px),
    2px calc(100% - 14px),
    2px calc(100% - 10px),
    4px calc(100% - 10px),
    4px calc(100% - 6px),
    6px calc(100% - 6px),
    6px calc(100% - 4px),
    10px calc(100% - 4px),
    10px calc(100% - 2px),
    14px calc(100% - 2px),
    14px 100%,
    calc(100% - 14px) 100%,
    calc(100% - 14px) calc(100% - 2px),
    calc(100% - 10px) calc(100% - 2px),
    calc(100% - 10px) calc(100% - 4px),
    calc(100% - 6px) calc(100% - 4px),
    calc(100% - 6px) calc(100% - 6px),
    calc(100% - 4px) calc(100% - 6px),
    calc(100% - 4px) calc(100% - 10px),
    calc(100% - 2px) calc(100% - 10px),
    calc(100% - 2px) calc(100% - 14px),
    100% calc(100% - 14px),
    100% 14px,
    calc(100% - 2px) 14px,
    calc(100% - 2px) 10px,
    calc(100% - 4px) 10px,
    calc(100% - 4px) 6px,
    calc(100% - 6px) 6px,
    calc(100% - 6px) 4px,
    calc(100% - 10px) 4px,
    calc(100% - 10px) 2px,
    calc(100% - 14px) 2px,
    calc(100% - 14px) 0px,
    14px 0px,
    14px 2px,
    10px 2px,
    10px 4px,
    6px 4px,
    6px 6px,
    4px 6px,
    4px 10px,
    2px 10px,
    2px 14px,
    0px 14px,
    0px 50%,
    2px 50%,
    2px 14px,
    4px 14px,
    4px 10px,
    6px 10px,
    6px 6px,
    10px 6px,
    10px 4px,
    14px 4px,
    14px 2px,
    calc(100% - 14px) 2px,
    calc(100% - 14px) 4px,
    calc(100% - 10px) 4px,
    calc(100% - 10px) 6px,
    calc(100% - 6px) 6px,
    calc(100% - 6px) 10px,
    calc(100% - 4px) 10px,
    calc(100% - 4px) 14px,
    calc(100% - 2px) 14px,
    calc(100% - 2px) calc(100% - 14px),
    calc(100% - 4px) calc(100% - 14px),
    calc(100% - 4px) calc(100% - 10px),
    calc(100% - 6px) calc(100% - 10px),
    calc(100% - 6px) calc(100% - 6px),
    calc(100% - 10px) calc(100% - 6px),
    calc(100% - 10px) calc(100% - 4px),
    calc(100% - 14px) calc(100% - 4px),
    calc(100% - 14px) calc(100% - 2px),
    14px calc(100% - 2px),
    14px calc(100% - 4px),
    10px calc(100% - 4px),
    10px calc(100% - 6px),
    6px calc(100% - 6px),
    6px calc(100% - 10px),
    4px calc(100% - 10px),
    4px calc(100% - 14px),
    2px calc(100% - 14px),
    2px 50%,
    0px 50%);
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: #000000;
  display: block;
  pointer-events: none;
}
.pixel-corners::after {
  margin: -2px;
}
</style>
