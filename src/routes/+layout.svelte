<script>
  onMount(() => {
    const navbar = document.querySelector('.navbar'); // Adjust selector
    if (navbar) {
      const height = navbar.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--navbar-height', `${height}px`);
    }
  });
</script> 
