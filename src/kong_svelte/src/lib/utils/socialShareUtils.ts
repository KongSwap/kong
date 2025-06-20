import { browser } from "$app/environment";
import { toastStore } from "$lib/stores/toastStore";

export function shareToTwitter(marketUrl: string, marketQuestion?: string) {
  if (browser) {
    const tweetText = encodeURIComponent(
      `"${marketQuestion || "Prediction Market"}" \n\nWhat's your prediction? Bet now on KongSwap!\n\n${marketUrl} \n#KongSwap #PredictionMarket`,
    );
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
    window.open(twitterUrl, "_blank");
  }
}

export function shareToFacebook(marketUrl: string) {
  if (browser) {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(marketUrl)}`;
    window.open(facebookUrl, "_blank");
  }
}

export function shareToReddit(marketUrl: string, marketQuestion?: string) {
  if (browser) {
    const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(marketUrl)}&title=${encodeURIComponent(marketQuestion || "Prediction Market")}`;
    window.open(redditUrl, "_blank");
  }
}

export function shareToTikTok(marketUrl: string) {
  if (browser) {
    navigator.clipboard
      .writeText(marketUrl)
      .then(() => {
        toastStore.info(
          "Link copied! Paste it in your TikTok caption to share this prediction market.",
          { title: "Share to TikTok" },
        );
        const hashtag = encodeURIComponent("KongSwap");
        const tiktokUrl = `https://www.tiktok.com/tag/${hashtag}`;
        window.open(tiktokUrl, "_blank");
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
        toastStore.error("Failed to copy link for TikTok", {
          title: "Error",
        });
        const hashtag = encodeURIComponent("KongSwap");
        const tiktokUrl = `https://www.tiktok.com/tag/${hashtag}`;
        window.open(tiktokUrl, "_blank");
      });
  }
}

export function shareToTelegram(marketUrl: string, marketQuestion?: string) {
  if (browser) {
    const telegramText = encodeURIComponent(
      `"${marketQuestion || "Prediction Market"}" on KongSwap: ${marketUrl}`,
    );
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(marketUrl)}&text=${telegramText}`;
    window.open(telegramUrl, "_blank");
  }
}

export function copyLinkToClipboard(marketUrl: string) {
  if (browser) {
    navigator.clipboard
      .writeText(marketUrl)
      .then(() => {
        toastStore.add({
          title: "Link Copied",
          message: "Market link copied to clipboard",
          type: "success",
        });
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
        toastStore.add({
          title: "Error",
          message: "Failed to copy link",
          type: "error",
        });
      });
  }
} 