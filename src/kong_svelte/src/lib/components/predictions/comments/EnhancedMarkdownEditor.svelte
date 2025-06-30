<script lang="ts">
  import {
    Bold,
    Italic,
    Image,
    List,
    Link,
    Eye,
    Edit,
    Code,
    Quote,
  } from "lucide-svelte";
  import { parseBasicMarkdown } from "$lib/utils/markdown";
  import ButtonV2 from "$lib/components/common/ButtonV2.svelte";
  import GiphyModal from "./GiphyModal.svelte";

  let {
    value = $bindable(),
    placeholder = "Write your comment...",
    maxLength = 500,
    disabled = false,
    onSubmit,
    submitText = "Submit",
    showSubmit = true,
    autoFocus = false,
  } = $props<{
    value?: string;
    placeholder?: string;
    maxLength?: number;
    disabled?: boolean;
    onSubmit?: () => void;
    submitText?: string;
    showSubmit?: boolean;
    autoFocus?: boolean;
  }>();

  // State
  let showPreview = $state(false);
  let showGiphyModal = $state(false);
  let textareaElement: HTMLTextAreaElement;
  let selectionStart = $state(0);
  let selectionEnd = $state(0);
  let undoStack = $state<{ value: string; timestamp: number }[]>([]);
  let redoStack = $state<{ value: string; timestamp: number }[]>([]);
  let lastValue = $state(value || "");
  let lastChangeTime = $state(Date.now());

  // Derived
  let remainingChars = $derived(maxLength - (value?.length || 0));
  let isOverLimit = $derived(remainingChars < 0);
  let canSubmit = $derived(
    value && value.trim().length > 0 && !isOverLimit && !disabled,
  );
  let parsedContent = $derived(value ? parseBasicMarkdown(value) : "");

  // Focus on mount if requested
  $effect(() => {
    if (autoFocus && textareaElement) {
      textareaElement.focus();
    }
  });

  // Track undo/redo
  $effect(() => {
    if (value !== lastValue) {
      // Only add to undo stack if the change is significant
      const timeSinceLastChange = Date.now() - lastChangeTime;
      if (
        timeSinceLastChange > 500 ||
        Math.abs((value?.length || 0) - lastValue.length) > 5
      ) {
        undoStack.push({ value: lastValue, timestamp: lastChangeTime });
        if (undoStack.length > 50) {
          undoStack.shift();
        }
        redoStack = [];
        lastChangeTime = Date.now();
      }
      lastValue = value || "";
    }
  });

  // Helper to insert formatting
  function insertFormatting(
    before: string,
    after: string,
    placeholder?: string,
  ) {
    if (!textareaElement || showPreview) return;

    const start = textareaElement.selectionStart;
    const end = textareaElement.selectionEnd;
    const selectedText = (value || "").substring(start, end);
    const textToInsert = selectedText || placeholder || "";

    const newValue =
      (value || "").substring(0, start) +
      before +
      textToInsert +
      after +
      (value || "").substring(end);

    value = newValue;

    // Set cursor position after formatting
    requestAnimationFrame(() => {
      if (textareaElement) {
        const newPosition = start + before.length + textToInsert.length;
        textareaElement.focus();
        textareaElement.setSelectionRange(newPosition, newPosition);
      }
    });
  }

  // Formatting functions
  function insertBold() {
    insertFormatting("**", "**", "bold text");
  }

  function insertItalic() {
    insertFormatting("*", "*", "italic text");
  }

  function insertImage() {
    insertFormatting("![", "](https://example.com/image.jpg)", "alt text");
  }

  function insertLink() {
    insertFormatting("[", "](https://example.com)", "link text");
  }

  function insertList() {
    const lines = (value || "").split("\n");
    const currentLineIndex =
      (value || "")
        .substring(0, textareaElement?.selectionStart || 0)
        .split("\n").length - 1;
    const currentLine = lines[currentLineIndex];

    if (currentLine.startsWith("- ")) {
      // Already a list item, add new item
      insertFormatting("\n- ", "", "");
    } else {
      // Convert to list item
      insertFormatting("- ", "", "");
    }
  }

  function insertCode() {
    const selectedText = (value || "").substring(
      textareaElement?.selectionStart || 0,
      textareaElement?.selectionEnd || 0,
    );

    if (selectedText.includes("\n")) {
      // Multi-line code block
      insertFormatting("```\n", "\n```", "code");
    } else {
      // Inline code
      insertFormatting("`", "`", "code");
    }
  }

  function insertQuote() {
    insertFormatting("> ", "", "quote");
  }

  // Handle GIF selection
  function handleGifSelect(gifUrl: string) {
    const insertion = `![GIF](${gifUrl})`;
    if (value) {
      value = value + "\n" + insertion;
    } else {
      value = insertion;
    }
    showGiphyModal = false;
  }

  // Undo/Redo
  function undo() {
    if (undoStack.length > 0) {
      const previous = undoStack.pop()!;
      redoStack.push({ value: value || "", timestamp: Date.now() });
      value = previous.value;
      lastChangeTime = Date.now();
    }
  }

  function redo() {
    if (redoStack.length > 0) {
      const next = redoStack.pop()!;
      undoStack.push({ value: value || "", timestamp: Date.now() });
      value = next.value;
      lastChangeTime = Date.now();
    }
  }

  // Handle keydown
  function handleKeydown(event: KeyboardEvent) {
    // Formatting shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case "b":
          event.preventDefault();
          insertBold();
          break;
        case "i":
          event.preventDefault();
          insertItalic();
          break;
        case "k":
          event.preventDefault();
          insertLink();
          break;
        case "z":
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
          break;
        case "y":
          event.preventDefault();
          redo();
          break;
      }
    }

    // Tab handling for lists
    if (event.key === "Tab" && !showPreview) {
      const lines = (value || "").split("\n");
      const cursorPos = textareaElement.selectionStart;
      const textBeforeCursor = (value || "").substring(0, cursorPos);
      const currentLineIndex = textBeforeCursor.split("\n").length - 1;
      const currentLine = lines[currentLineIndex];

      if (currentLine.trim().startsWith("-")) {
        event.preventDefault();
        if (event.shiftKey) {
          // Outdent
          if (currentLine.startsWith("  ")) {
            lines[currentLineIndex] = currentLine.substring(2);
            value = lines.join("\n");
          }
        } else {
          // Indent
          lines[currentLineIndex] = "  " + currentLine;
          value = lines.join("\n");
        }
      }
    }
  }

  // Auto-resize textarea
  function autoResize() {
    if (textareaElement && !showPreview) {
      textareaElement.style.height = "auto";
      textareaElement.style.height = `${textareaElement.scrollHeight}px`;
    }
  }

  // Update textarea height when value changes
  $effect(() => {
    if (value !== undefined) {
      requestAnimationFrame(autoResize);
    }
  });

  // Toggle preview
  function togglePreview() {
    showPreview = !showPreview;
    if (!showPreview && textareaElement) {
      requestAnimationFrame(() => {
        textareaElement.focus();
        autoResize();
      });
    }
  }
</script>

<div class="enhanced-markdown-editor">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-group">
      <button
        type="button"
        onclick={insertBold}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Bold (Ctrl+B)"
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        onclick={insertItalic}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Italic (Ctrl+I)"
      >
        <Italic size={16} />
      </button>
      <div class="toolbar-divider" />
      <button
        type="button"
        onclick={insertLink}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Link (Ctrl+K)"
      >
        <Link size={16} />
      </button>
      <button
        type="button"
        onclick={insertImage}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Image"
      >
        <Image size={16} />
      </button>
      <button
        type="button"
        onclick={() => (showGiphyModal = true)}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Insert GIF"
      >
        <span class="text-xs font-bold">GIF</span>
      </button>
      <div class="toolbar-divider" />
      <button
        type="button"
        onclick={insertList}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="List"
      >
        <List size={16} />
      </button>
      <button
        type="button"
        onclick={insertCode}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Code"
      >
        <Code size={16} />
      </button>
      <button
        type="button"
        onclick={insertQuote}
        disabled={disabled || showPreview}
        class="toolbar-button"
        title="Quote"
      >
        <Quote size={16} />
      </button>
    </div>

    <div class="toolbar-group">
      <button
        type="button"
        onclick={togglePreview}
        class="toolbar-button"
        title={showPreview ? "Edit" : "Preview"}
      >
        {#if showPreview}
          <Edit size={16} />
        {:else}
          <Eye size={16} />
        {/if}
      </button>
    </div>
  </div>

  <!-- Editor/Preview Area -->
  <div class="editor-container">
    {#if showPreview}
      <div class="preview-area">
        {#if value?.trim()}
          {@html parsedContent}
        {:else}
          <p class="text-kong-text-secondary/50 italic">Nothing to preview</p>
        {/if}
      </div>
    {:else}
      <textarea
        bind:this={textareaElement}
        bind:value
        onkeydown={handleKeydown}
        oninput={autoResize}
        {placeholder}
        {disabled}
        class="editor-textarea"
        rows="4"
      ></textarea>
    {/if}
  </div>

  <!-- Footer -->
  <div class="editor-footer">
    <div class="char-count" class:over-limit={isOverLimit}>
      {remainingChars} characters remaining
    </div>

    {#if showSubmit && onSubmit}
      <ButtonV2
        onclick={onSubmit}
        disabled={!canSubmit}
        theme="primary"
        size="sm"
      >
        {submitText}
      </ButtonV2>
    {/if}
  </div>
</div>

<GiphyModal
  isOpen={showGiphyModal}
  onClose={() => (showGiphyModal = false)}
  onSelectGif={handleGifSelect}
/>

<style lang="postcss">
  .enhanced-markdown-editor {
    @apply bg-kong-bg-tertiary border border-kong-border/50 rounded-md overflow-hidden;
    transition: border-color 0.2s;
  }

  .enhanced-markdown-editor:focus-within {
    @apply border-kong-primary/50;
    box-shadow: 0 0 0 1px rgb(var(--ui-primary) / 0.1);
  }

  .toolbar {
    @apply flex items-center justify-between gap-2 px-2 py-1 border-b border-kong-border/30;
    @apply bg-kong-bg-secondary/30;
  }

  .toolbar-group {
    @apply flex items-center gap-1;
  }

  .toolbar-button {
    @apply p-1.5 rounded hover:bg-kong-bg-tertiary/50 transition-colors;
    @apply text-kong-text-secondary hover:text-kong-text-primary;
    @apply disabled:opacity-50 disabled:cursor-not-allowed;
  }

  .toolbar-divider {
    @apply w-px h-4 bg-kong-border/30 mx-1;
  }

  .editor-container {
    @apply relative min-h-[120px] max-h-[400px] overflow-y-auto;
  }

  .editor-textarea {
    @apply w-full p-3 bg-transparent border-0 resize-none;
    @apply text-sm text-kong-text-primary placeholder:text-kong-text-secondary/50;
    @apply focus:outline-none focus:ring-0;
    min-height: 120px;
  }

  .preview-area {
    @apply p-3 min-h-[120px];
    @apply text-sm text-kong-text-primary;
  }

  .preview-area :where(pre code) {
    @apply p-0 bg-transparent;
  }

  .preview-area :where(ul li) {
    @apply list-disc ml-4 mb-1;
  }

  .preview-area :where(ol li) {
    @apply list-decimal ml-4 mb-1;
  }

  .editor-footer {
    @apply flex items-center justify-between px-3 py-2;
    @apply border-t border-kong-border/30 bg-kong-bg-secondary/30;
  }

  .char-count {
    @apply text-xs text-kong-text-secondary;
  }

  .char-count.over-limit {
    @apply text-kong-error;
  }

  /* Scrollbar styling */
  .editor-container {
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--ui-border) / 0.3) transparent;
  }

  .editor-container::-webkit-scrollbar {
    width: 6px;
  }

  .editor-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .editor-container::-webkit-scrollbar-thumb {
    background-color: rgb(var(--ui-border) / 0.3);
    border-radius: 3px;
  }

  .editor-container::-webkit-scrollbar-thumb:hover {
    background-color: rgb(var(--ui-border) / 0.5);
  }
</style>
