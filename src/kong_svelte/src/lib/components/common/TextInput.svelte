<script lang="ts">
    type Variant = 'default' | 'primary' | 'error' | 'success';
    type Size = 'sm' | 'md' | 'lg';

    export let id: string;
    export let label: string = '';
    export let value: string = '';
    export let placeholder: string = '';
    export let type: 'text' | 'password' | 'email' | 'number' = 'text';
    export let error: string = '';
    export let helperText: string = '';
    export let disabled: boolean = false;
    export let required: boolean = false;
    export let maxlength: number | undefined = undefined;
    export let min: number | undefined = undefined;
    export let max: number | undefined = undefined;
    export let step: number | undefined = undefined;
    export let className: string = '';
    export let variant: Variant = 'default';
    export let size: Size = 'md';

    const variants = {
        default: {
            input: 'border-white/10 focus:border-yellow-400',
            bg: 'bg-white/5 focus:bg-white/10',
            text: 'text-white placeholder-white/50',
        },
        primary: {
            input: 'border-blue-500/30 focus:border-blue-400',
            bg: 'bg-blue-500/5 focus:bg-blue-500/10',
            text: 'text-white placeholder-white/50',
        },
        error: {
            input: 'border-red-500/30 focus:border-red-400',
            bg: 'bg-red-500/5 focus:bg-red-500/10',
            text: 'text-white placeholder-white/50',
        },
        success: {
            input: 'border-green-500/30 focus:border-green-400',
            bg: 'bg-green-500/5 focus:bg-green-500/10',
            text: 'text-white placeholder-white/50',
        },
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-3 text-base',
        lg: 'px-4 py-4 text-2xl font-play placeholder:font-play',
    };

    function handleInput(event: Event) {
        const target = event.target as HTMLInputElement;
        value = target.value;
    }

    $: variantClasses = variants[error ? 'error' : variant];
    $: sizeClass = sizes[size];
</script>

<div class="flex flex-col gap-2 w-full {className} font-play">
    {#if label}
        <label 
            for={id} 
            class="text-sm font-medium text-white/90"
        >
            {label}
            {#if required}
                <span class="text-red-500 ml-1">*</span>
            {/if}
        </label>
    {/if}
    
    <input
        {id}
        {type}
        {placeholder}
        {disabled}
        {required}
        {maxlength}
        {min}
        {max}
        {step}
        class="
            w-full
            border-2
            rounded-lg
            transition-all duration-200
            focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed
            {variantClasses.input}
            {variantClasses.bg}
            {variantClasses.text}
            {sizeClass}
        "
        {value}
        on:input={handleInput}
        on:blur
        on:focus
        on:keydown
        on:keyup
        on:keypress
    />

    {#if error}
        <span class="text-xs text-red-500">{error}</span>
    {:else if helperText}
        <span class="text-xs text-white/60">{helperText}</span>
    {/if}
</div>