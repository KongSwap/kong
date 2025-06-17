<!-- NotificationsPanel.svelte -->
<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { 
    X as IconClose,
    CheckCircle2 as IconSuccess,
    AlertCircle as IconError,
    AlertTriangle as IconWarning,
    Info as IconInfo,
    Bell,
    Clock
  } from "lucide-svelte";
  import Badge from "$lib/components/common/Badge.svelte";
  import { notificationsStore } from "$lib/stores/notificationsStore";
  import { toastStore, type Toast } from "$lib/stores/toastStore";

  // Date formatting imports
  import {
    format,
    formatDistance,
    isToday,
    isYesterday,
    startOfWeek,
    isWithinInterval,
    subDays,
  } from "date-fns";

  // Props type definition
  type NotificationsPanelProps = {
    onClose?: () => void;
  };

  // Destructure props with defaults
  let { 
    onClose = () => {} 
  }: NotificationsPanelProps = $props();

  // Clear all notifications from history
  function clearAllNotifications() {
    notificationsStore.clearAll();
  }

  // Remove a single notification
  function removeNotification(id: string) {
    notificationsStore.remove(id);
  }

  // Format time for display
  function formatTime(timestamp: number) {
    return format(new Date(timestamp), "h:mm a");
  }

  // Format date for display
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);

    if (isToday(date)) {
      return "Today";
    }

    if (isYesterday(date)) {
      return "Yesterday";
    }

    // This week (within 7 days)
    const now = new Date();
    if (isWithinInterval(date, { start: subDays(now, 7), end: now })) {
      return format(date, "EEEE"); // Full weekday name
    }

    // Older
    return format(date, "MMM d, yyyy");
  }

  // Get relative time (e.g., "2 hours ago")
  function getRelativeTime(timestamp: number): string {
    return formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
  }

  // Group notifications by date - convert to $derived
  const groupedNotifications = $derived($notificationsStore.history.reduce<
    Record<string, Toast[]>
  >((groups, toast) => {
    const dateKey = formatDate(toast.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(toast);
    return groups;
  }, {}));

  // Sort date keys - convert to $derived
  const sortedDateKeys = $derived(Object.keys(groupedNotifications).sort((a, b) => {
    if (a === "Today") return -1;
    if (b === "Today") return 1;
    if (a === "Yesterday") return -1;
    if (b === "Yesterday") return 1;
    return 0;
  }));

  // Count notifications by type for the summary - convert to $derived
  const errorCount = $derived($notificationsStore.history.filter(
    (n) => n.type === "error",
  ).length);
  
  const warningCount = $derived($notificationsStore.history.filter(
    (n) => n.type === "warning",
  ).length);
  
  const successCount = $derived($notificationsStore.history.filter(
    (n) => n.type === "success",
  ).length);
  
  const infoCount = $derived($notificationsStore.history.filter(
    (n) => n.type === "info",
  ).length);

  // Calculate total notification count - convert to $derived
  const totalNotificationCount = $derived($notificationsStore.history.length);

  // Memoize the icon and class mappings
  const ICONS = {
    success: IconSuccess,
    error: IconError,
    warning: IconWarning,
    info: IconInfo,
  } as const;

  const TYPE_CLASSES = {
    success: "toast-success",
    error: "toast-error",
    warning: "toast-warning",
    info: "toast-info",
  } as const;

  const ICON_COLORS = {
    success: "text-kong-success",
    error: "text-kong-error",
    warning: "text-kong-accent-yellow",
    info: "text-kong-accent-blue",
  } as const;

  const BADGE_VARIANTS = {
    success: "green",
    error: "red",
    warning: "yellow",
    info: "blue",
  } as const;
</script>

<div class="flex-1 overflow-y-auto py-3 scrollbar-thin rounded-bl-xl">
  {#if $notificationsStore.history.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-2 p-8 h-full text-kong-text-secondary text-sm"
    >
      <div
        class="p-8 rounded-full bg-kong-text-primary/5 mb-3"
        style="box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.03);"
      >
        <Bell size={28} class="text-kong-primary/40" />
      </div>
      <p class="text-lg font-medium text-kong-text-primary">
        No notifications
      </p>
      <p
        class="text-sm text-kong-text-secondary/70 max-w-[280px] text-center mt-1"
        style="line-height: 1.5;"
      >
        Notifications will appear here when you receive them
      </p>
    </div>
  {:else}
    <!-- Notification summary -->
    <div
      class="mx-5 mb-4 p-3 rounded-md bg-kong-bg-secondary/5 border border-kong-border/40"
      style="box-shadow: none;"
    >
      <div class="flex items-center justify-between mb-2">
        <span
          class="text-xs font-medium text-kong-text-secondary/90"
          style="letter-spacing: 0.01em;">Summary</span
        >
        <div class="flex items-center gap-3">
          <span class="text-xs text-kong-text-secondary/70"
            >{totalNotificationCount} notification{totalNotificationCount !==
            1
              ? "s"
              : ""}</span
          >
          <button
            class="text-xs text-kong-text-secondary/70 hover:text-kong-text-primary px-1.5 py-0.5 rounded hover:bg-kong-bg-secondary/20 transition-colors"
            onclick={clearAllNotifications}
          >
            Clear All
          </button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        {#if errorCount > 0}
          <div
            class="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md border border-transparent transition-colors bg-kong-error/5 text-kong-error/90 border-kong-error/10"
          >
            <IconError class="w-3.5 h-3.5" />
            <span
              >{errorCount} {errorCount === 1 ? "Error" : "Errors"}</span
            >
          </div>
        {/if}
        {#if warningCount > 0}
          <div
            class="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md border border-transparent transition-colors bg-kong-accent-yellow/5 text-kong-accent-yellow/90 border-kong-accent-yellow/10"
          >
            <IconWarning class="w-3.5 h-3.5" />
            <span
              >{warningCount}
              {warningCount === 1 ? "Warning" : "Warnings"}</span
            >
          </div>
        {/if}
        {#if successCount > 0}
          <div
            class="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md border border-transparent transition-colors bg-kong-success/5 text-kong-success/90 border-kong-success/10"
          >
            <IconSuccess class="w-3.5 h-3.5" />
            <span
              >{successCount}
              {successCount === 1 ? "Success" : "Successes"}</span
            >
          </div>
        {/if}
        {#if infoCount > 0}
          <div
            class="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md border border-transparent transition-colors bg-kong-accent-blue/5 text-kong-accent-blue/90 border-kong-accent-blue/10"
          >
            <IconInfo class="w-3.5 h-3.5" />
            <span>{infoCount} Info</span>
          </div>
        {/if}
      </div>
    </div>

    {#each sortedDateKeys as dateKey}
      <div class="mb-6">
        <div
          class="flex items-center text-xs font-semibold text-kong-text-secondary/90 px-5 py-2 sticky top-0 bg-kong-bg-primary/95 backdrop-blur-sm z-10"
        >
          <span
            class="inline-block px-2.5 py-1 rounded-md bg-kong-text-primary/10 font-medium"
            >{dateKey}</span
          >
        </div>

        <div class="space-y-2 px-5 mt-2">
          {#each groupedNotifications[dateKey] as notification (notification.id)}
            <div
              class="p-4 rounded-lg flex items-start gap-4 border border-transparent transition-all duration-200 hover:border-kong-border/60 relative hover:bg-kong-bg-secondary/5 group {TYPE_CLASSES[
                notification.type
              ] || ''}"
              style="background: linear-gradient(to right, rgba(255, 255, 255, 0.015), transparent);"
              transition:slide|local={{ duration: 150 }}
            >
              <div
                class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-kong-bg-secondary/10 border border-kong-border/30 {notification.type ===
                'success'
                  ? 'bg-kong-success/10 border-kong-success/30'
                  : ''} {notification.type === 'error'
                  ? 'bg-kong-error/10 border-kong-error/30'
                  : ''} {notification.type === 'warning'
                  ? 'bg-kong-accent-yellow/10 border-kong-accent-yellow/30'
                  : ''} {notification.type === 'info'
                  ? 'bg-kong-accent-blue/10 border-kong-accent-blue/30'
                  : ''}"
              >
                {#if ICONS[notification.type]}
                  <svelte:component
                    this={ICONS[notification.type]}
                    class="w-[20px] h-[20px] {ICON_COLORS[
                      notification.type
                    ]}"
                  />
                {/if}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <div
                      class="text-sm font-medium text-kong-text-primary"
                      style="letter-spacing: -0.01em;"
                    >
                      {notification.title || "Notification"}
                    </div>
                    <Badge
                      variant={BADGE_VARIANTS[notification.type] ||
                        "blue"}
                      size="xs"
                      class="text-[10px] uppercase tracking-wide font-semibold"
                    >
                      {notification.type}
                    </Badge>
                  </div>

                  <div
                    class="text-xs text-kong-text-secondary/60 flex items-center gap-1"
                    title={formatTime(notification.timestamp)}
                  >
                    <Clock
                      size={12}
                      class="text-kong-text-secondary/40"
                    />
                    <span>{getRelativeTime(notification.timestamp)}</span>
                  </div>
                </div>

                <div
                  class="text-sm text-kong-text-secondary mt-1.5 break-words leading-relaxed"
                  style="line-height: 1.5;"
                >
                  {notification.message}
                </div>
              </div>

              <button
                class="absolute top-4 right-4 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-kong-text-secondary/40 hover:text-kong-text-primary transition-all duration-200 opacity-0 hover:bg-kong-bg-secondary/30 group-hover:opacity-100"
                onclick={() => removeNotification(notification.id)}
                aria-label="Dismiss notification"
              >
                <IconClose size={14} />
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  {/if}
</div>

<style>
  /* Custom styles that can't be represented with Tailwind */
  :global(.notifications-content::-webkit-scrollbar) {
    width: 0.375rem; /* w-1.5 */
  }

  :global(.notifications-content::-webkit-scrollbar-track) {
    background-color: transparent; /* bg-transparent */
  }

  :global(.notifications-content::-webkit-scrollbar-thumb) {
    background-color: var(--kong-border); /* bg-kong-border */
    border-radius: 9999px; /* rounded-full */
  }

  /* Apply hover effect to notification items */
  .group:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
  }
</style> 