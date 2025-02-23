// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface Platform {}
  }

  interface Result<T> {
    Ok?: T;
    Err?: string;
  }

  // Activity types used in our app
  namespace Launchpad {
    interface BaseActivity {
      type: 'launch' | 'miner' | 'change' | 'topup' | 'ticker';
      token: string;
      time: string;
      color: string;
    }

    interface SystemActivity extends BaseActivity {
      type: 'launch' | 'miner' | 'change' | 'topup';
      action: string;
      principal: string;
      hash: string;
      details: string;
      power?: string;
      boost?: string;
      minerType?: string;
    }

    interface TickerActivity extends BaseActivity {
      type: 'ticker';
      priceChange: string;
      volume: string;
    }

    type Activity = SystemActivity | TickerActivity;

    // Type guard functions
    function isSystemActivity(activity: Activity): activity is SystemActivity {
      return activity.type !== 'ticker';
    }

    function isTickerActivity(activity: Activity): activity is TickerActivity {
      return activity.type === 'ticker';
    }
  }
}

export {};
