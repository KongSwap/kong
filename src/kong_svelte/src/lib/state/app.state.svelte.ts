import { browser } from "$app/environment";

export const app = $state({ 
    isMobile: browser ? window.innerWidth < 768 : false,
});