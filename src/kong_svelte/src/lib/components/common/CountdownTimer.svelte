<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  export let endTime: number;
  export let showSeconds: boolean = true;
  let timer = '';
  let intervalId: ReturnType<typeof setInterval>;

  function updateTimer() {
    const now = Date.now();
    const endMs = Number(endTime) / 1_000_000; // convert nanoseconds to milliseconds
    const diff = endMs - now;
    if (diff <= 0) {
      timer = 'Ended';
      clearInterval(intervalId);
      return;
    }
    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) {
      if (showSeconds) {
        timer = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      } else {
        timer = `${days}d ${hours}h ${minutes}m`;
      }
    } else if (hours > 0) {
      if (showSeconds) {
        timer = `${hours}h ${minutes}m ${seconds}s`;
      } else {
        timer = `${hours}h ${minutes}m`;
      }
    } else if (minutes > 0) {
      if (showSeconds) {
        timer = `${minutes}m ${seconds}s`;
      } else {
        timer = `${minutes}m`;
      }
    } else {
      // Less than a minute, always show seconds
      timer = `${seconds}s`;
    }
  }

  onMount(() => {
    updateTimer();
    intervalId = setInterval(updateTimer, 1000);
  });

  onDestroy(() => {
    clearInterval(intervalId);
  });
</script>

<span>{timer}</span> 