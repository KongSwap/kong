<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  export let endTime: number;
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
      timer = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else {
      timer = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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