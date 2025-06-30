<script lang="ts">
  import { commentsApi } from "$lib/api/comments";
  import { toastStore } from "$lib/stores/toastStore";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import GiphyModal from "./GiphyModal.svelte";
  import EnhancedMarkdownEditor from "./EnhancedMarkdownEditor.svelte";
  import { Send, X, Bold, Italic, Image } from "lucide-svelte";

  let {
    contextId,
    parentId = null,
    editingComment = null,
    onCommentCreated,
    onCancel,
    placeholder = "Write a comment...",
  } = $props<{
    contextId: string;
    parentId?: bigint | null;
    editingComment?: any | null;
    onCommentCreated: (comment?: any) => void;
    onCancel?: () => void;
    placeholder?: string;
  }>();

  // Consolidated state
  let state = $state({
    content: editingComment?.content || "",
    isSubmitting: false,
    error: null as string | null,
    showGiphyModal: false,
    useEnhancedEditor: true,
    textareaElement: null as HTMLTextAreaElement | null,
  });

  // Constants
  const MAX_LENGTH = 500;
  const FORMATTING_SHORTCUTS = {
    b: { before: "**", after: "**", placeholder: "bold text" },
    i: { before: "*", after: "*", placeholder: "italic text" },
  };

  // Derived values
  let remainingChars = $derived(MAX_LENGTH - state.content.length);
  let isOverLimit = $derived(remainingChars < 0);
  let canSubmit = $derived(
    state.content.trim().length > 0 && !isOverLimit && !state.isSubmitting,
  );

  // Auto-focus on mount for editing
  $effect(() => {
    if (editingComment && state.textareaElement && !state.useEnhancedEditor) {
      state.textareaElement.focus();
      state.textareaElement.setSelectionRange(
        state.content.length,
        state.content.length,
      );
    }
  });

  // Handlers
  async function handleSubmit() {
    if (!canSubmit) return;

    state.isSubmitting = true;
    state.error = null;

    try {
      const trimmedContent = state.content.trim();

      if (editingComment) {
        const edited = await commentsApi.editComment({
          comment_id: editingComment.id,
          content: trimmedContent,
        });
        toastStore.success("Comment updated");
        onCommentCreated(edited);
      } else {
        const newComment = await commentsApi.createComment({
          context_id: contextId,
          content: trimmedContent,
          parent_id: parentId,
        });
        toastStore.success(parentId ? "Reply posted" : "Comment posted");
        state.content = "";
        // Pass the new comment for optimistic update
        onCommentCreated(newComment);
      }
    } catch (e) {
      console.error("Failed to submit comment:", e);
      state.error = e instanceof Error ? e.message : "Failed to submit comment";
    } finally {
      state.isSubmitting = false;
    }
  }

  function handleCancel() {
    state.content = editingComment?.content || "";
    state.error = null;
    onCancel?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    // Submit on Enter without Shift
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
      return;
    }

    // Formatting shortcuts
    if ((event.ctrlKey || event.metaKey) && event.key in FORMATTING_SHORTCUTS) {
      event.preventDefault();
      const shortcut =
        FORMATTING_SHORTCUTS[event.key as keyof typeof FORMATTING_SHORTCUTS];
      insertFormatting(shortcut.before, shortcut.after, shortcut.placeholder);
    }
  }

  // Optimized auto-resize using ResizeObserver
  let resizeObserver: ResizeObserver | null = null;

  $effect(() => {
    if (state.textareaElement && !state.useEnhancedEditor) {
      resizeObserver = new ResizeObserver(() => {
        if (state.textareaElement) {
          state.textareaElement.style.height = "auto";
          state.textareaElement.style.height = `${state.textareaElement.scrollHeight}px`;
        }
      });
      resizeObserver.observe(state.textareaElement);

      return () => {
        resizeObserver?.disconnect();
      };
    }
  });

  // Formatting helper
  function insertFormatting(
    before: string,
    after: string,
    placeholder: string,
  ) {
    if (!state.textareaElement || state.useEnhancedEditor) return;

    const { selectionStart: start, selectionEnd: end } = state.textareaElement;
    const selectedText = state.content.substring(start, end);
    const textToInsert = selectedText || placeholder;

    state.content =
      state.content.substring(0, start) +
      before +
      textToInsert +
      after +
      state.content.substring(end);

    // Set cursor position after formatting
    requestAnimationFrame(() => {
      if (state.textareaElement) {
        const newPosition = start + before.length + textToInsert.length;
        state.textareaElement.focus();
        state.textareaElement.setSelectionRange(newPosition, newPosition);
      }
    });
  }

  function handleGifSelect(gifUrl: string) {
    const gifMarkdown = `![GIF](${gifUrl})`;

    if (state.useEnhancedEditor) {
      state.content = state.content + (state.content ? "\n" : "") + gifMarkdown;
    } else {
      // Insert at cursor position
      if (state.textareaElement) {
        const { selectionStart } = state.textareaElement;
        state.content =
          state.content.substring(0, selectionStart) +
          gifMarkdown +
          state.content.substring(selectionStart);
      } else {
        state.content += gifMarkdown;
      }
    }
    state.showGiphyModal = false;
  }

  // Toolbar actions
  const toolbarActions = [
    {
      icon: Bold,
      action: () => insertFormatting("**", "**", "bold text"),
      title: "Bold (Ctrl+B)",
    },
    {
      icon: Italic,
      action: () => insertFormatting("*", "*", "italic text"),
      title: "Italic (Ctrl+I)",
    },
    {
      icon: Image,
      action: () =>
        insertFormatting("![", "](https://example.com/image.jpg)", "alt text"),
      title: "Insert Image",
    },
  ];
</script>

<div class="comment-input">
  {#if state.useEnhancedEditor}
    <EnhancedMarkdownEditor
      bind:value={state.content}
      {placeholder}
      maxLength={MAX_LENGTH}
      disabled={state.isSubmitting}
      onSubmit={handleSubmit}
      submitText={state.isSubmitting
        ? "Posting..."
        : editingComment
          ? "Update"
          : parentId
            ? "Reply"
            : "Comment"}
      showSubmit={true}
      autoFocus={!!editingComment}
    />

    {#if editingComment || onCancel}
      <div class="mt-2 flex justify-end">
        <ButtonV2
          theme="secondary"
          onclick={handleCancel}
          disabled={state.isSubmitting}
          size="sm"
        >
          <X size={14} class="mr-1" />
          Cancel
        </ButtonV2>
      </div>
    {/if}
  {:else}
    <div class="input-wrapper">
      <!-- Optimized toolbar -->
      <div
        class="flex items-center gap-1 mb-2 border-b border-kong-border/30 pb-2"
      >
        {#each toolbarActions as action}
          {@const Icon = action.icon}
          <button
            type="button"
            onclick={action.action}
            class="p-1.5 rounded hover:bg-kong-bg-tertiary/50 transition-colors
                   text-kong-text-secondary hover:text-kong-text-primary"
            title={action.title}
          >
            <Icon size={16} />
          </button>
        {/each}
        <div class="w-px h-4 bg-kong-border/30 mx-1"></div>
        <button
          type="button"
          onclick={() => (state.showGiphyModal = true)}
          class="p-1.5 rounded hover:bg-kong-bg-tertiary/50 transition-colors
                 text-kong-text-secondary hover:text-kong-text-primary"
          title="Insert GIF"
        >
          <span class="text-xs font-bold">GIF</span>
        </button>
      </div>

      <textarea
        bind:this={state.textareaElement}
        bind:value={state.content}
        onkeydown={handleKeydown}
        oninput={() =>
          state.textareaElement?.dispatchEvent(new Event("resize"))}
        {placeholder}
        disabled={state.isSubmitting}
        class="w-full resize-none text-sm text-kong-text-primary
               placeholder:text-kong-text-secondary/50
               focus:outline-none transition-colors
               disabled:opacity-50 disabled:cursor-not-allowed
               min-h-[80px] max-h-[200px]"
        rows="3"
      ></textarea>
    </div>
  {/if}

  {#if state.error}
    <p class="text-xs text-kong-error mt-1">{state.error}</p>
  {/if}

  {#if !state.useEnhancedEditor}
    <div class="flex items-center justify-between mt-2">
      <span
        class="text-xs {isOverLimit
          ? 'text-kong-error'
          : 'text-kong-text-secondary'}"
      >
        {remainingChars} characters remaining
      </span>

      <div class="flex items-center gap-2">
        {#if editingComment || onCancel}
          <ButtonV2
            theme="secondary"
            onclick={handleCancel}
            disabled={state.isSubmitting}
          >
            <X size={14} class="mr-1" />
            Cancel
          </ButtonV2>
        {/if}

        <ButtonV2 theme="primary" onclick={handleSubmit} disabled={!canSubmit}>
          <Send size={14} class="mr-1" />
          {state.isSubmitting
            ? "Posting..."
            : editingComment
              ? "Update"
              : parentId
                ? "Reply"
                : "Comment"}
        </ButtonV2>
      </div>
    </div>
  {/if}
</div>

<GiphyModal
  isOpen={state.showGiphyModal}
  onClose={() => (state.showGiphyModal = false)}
  onSelectGif={handleGifSelect}
/>

<style lang="postcss">
  .comment-input {
    @apply w-full;
  }

  .input-wrapper {
    @apply bg-kong-bg-tertiary border border-kong-border/50 rounded-md p-2;
    transition: border-color 0.2s;
  }

  .input-wrapper:focus-within {
    @apply border-kong-primary/50;
    box-shadow: 0 0 0 1px rgb(var(--ui-primary) / 0.1);
  }

  .input-wrapper textarea {
    @apply bg-transparent border-0 p-2 -m-2 focus:ring-0;
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--ui-border) / 0.3) transparent;
  }

  .input-wrapper textarea::-webkit-scrollbar {
    width: 6px;
  }

  .input-wrapper textarea::-webkit-scrollbar-track {
    background: transparent;
  }

  .input-wrapper textarea::-webkit-scrollbar-thumb {
    background-color: rgb(var(--ui-border) / 0.3);
    border-radius: 3px;
  }

  .input-wrapper textarea::-webkit-scrollbar-thumb:hover {
    background-color: rgb(var(--ui-border) / 0.5);
  }
</style>
