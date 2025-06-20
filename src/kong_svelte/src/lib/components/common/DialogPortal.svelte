<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  /**
   * A Svelte action that moves the element to the body element
   */
  function portal(node: HTMLElement) {
    // Function to move the element to the document body
    const move = () => {
      document.body.appendChild(node);
    };

    // Move the element when the action is applied
    move();

    return {
      // When the component is destroyed, remove the node
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    };
  }

  let {
    children = [],
  } = $props<{
    children: any;
  }>();

  let container: HTMLDivElement;
  
  onMount(() => {
    // Ensure z-index is high enough to be on top of everything else
    if (container) {
      container.style.zIndex = "10000";  
    }
  });
</script>

<div bind:this={container} use:portal>
  {@render children?.()}
</div> 