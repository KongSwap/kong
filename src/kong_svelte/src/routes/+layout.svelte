<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/stores"; // Import the $page store
  import Navbar from "$lib/components/nav/Navbar.svelte";
  import Toast from "$lib/components/common/Toast.svelte";
  import { t } from "$lib/locales/translations";
  import { currentEnvMode } from "$lib/utils/envUtils";
  import { restoreWalletConnection } from "$lib/stores/walletStore";
  import { switchLocale } from "$lib/stores/localeStore";
  import { tokenStore } from "$lib/stores/tokenStore";
  import { poolStore } from "$lib/stores/poolStore";
  import LoadingIndicator from "$lib/components/stats/LoadingIndicator.svelte";
  import { walletStore } from "$lib/stores/walletStore";
  import poolsBackground from "$lib/assets/backgrounds/pools.webp";
  import jungleBackground from "$lib/assets/backgrounds/kong_jungle2.webp";
    import { browser } from "$app/environment";

  let initialized: boolean = false;
  let backgroundImage: string = jungleBackground;

  onMount(async () => {
    switchLocale("en");
    Promise.all([restoreWalletConnection(), tokenStore.loadTokens(), poolStore.loadPools()]);
    if($walletStore.isConnected) {
      tokenStore.loadBalances();
    }
    initialized = true;
  });

  $: {
    if(browser) {
    switch($page.url.pathname) {
      case '/pools':
        document.body.style.background = `#013437 url(${poolsBackground})`;
        break;
      case '/stats':
        document.body.style.background = "#5BB2CF";
        break;
      case '/swap':
        document.body.style.background = `#5BB2CF url(${jungleBackground})`;
        break;
      default:
        document.body.style.background = `#5BB2CF url(${jungleBackground})`;
        break;
    }

      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
    }
  }
</script>

<div class="flex justify-center">
  <Navbar />
</div>

<Toast />

<svelte:head>
  <title>
    {currentEnvMode() ? `[${currentEnvMode()}] KongSwap` : `KongSwap`} - {$t("common.browserSubtitle")}
  </title>
</svelte:head>


<slot />

