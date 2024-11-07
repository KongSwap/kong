export const getExplorerLinks = (transferArray) => {
    if (!transferArray || transferArray.length === 0) return [];
  
    return transferArray.reduce((acc, transfer) => {
      const symbol = transfer.transfer?.IC?.symbol || "";
      const blockIndex = transfer.transfer?.IC?.block_index || "";
      const canisterId = transfer.transfer?.IC?.canister_id || "";
      let link = "#"; // Default link in case no match is found
  
      // Define the logic to generate links based on the symbol
      switch (symbol) {
        case "ICP":
          link = `https://dashboard.internetcomputer.org/transaction/${blockIndex}`;
          break;
        case "ckBTC":
          link = `https://dashboard.internetcomputer.org/bitcoin/transactions/${blockIndex}`;
          break;
        case "ckETH":
          link = `https://dashboard.internetcomputer.org/ethereum/transactions/${blockIndex}`;
          break;
        case "ckUSDT":
            link = `https://dashboard.internetcomputer.org/ethereum/cngnf-vqaaa-aaaar-qag4q-cai/transaction/${blockIndex}`;
          break;
        case "ckUSDC":
            link = `https://dashboard.internetcomputer.org/ethereum/xevnm-gaaaa-aaaar-qafnq-cai/transaction/${blockIndex}`;
            break;
        case "EXE":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "SNEED":
          link = `https://dashboard.internetcomputer.org/sns/fp274-iaaaa-aaaaq-aacha-cai/transaction/${blockIndex}`; // Placeholder, update if actual URL is found
          break;
        case "BOB":
          link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`; // Placeholder, update if actual URL is found
          break;
        case "WUMBO":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "DAMONIC":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "ALPACALB":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "CHAT":
            link = `https://dashboard.internetcomputer.org/sns/3e3x2-xyaaa-aaaaq-aaalq-cai/transaction/${blockIndex}`;
          break;
        case "ND64":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "DKP":
            link = `https://dashboard.internetcomputer.org/sns/zxeu2-7aaaa-aaaaq-aaafa-cai/transaction/${blockIndex}`;
          break;
        case "YUGE":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "WTN":
            link = `https://dashboard.internetcomputer.org/sns/jmod6-4iaaa-aaaaq-aadkq-cai/transaction/${blockIndex}`;
          break;
        case "Bits":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "nICP":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "MCS":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "PARTY":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "CLOWN":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "nanas":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "BURN":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "NTN":
            link = `https://dashboard.internetcomputer.org/sns/extk7-gaaaa-aaaaq-aacda-cai/transaction/${blockIndex}`;
          break;
        case "DCD":
            link = `https://dashboard.internetcomputer.org/sns/x4kx5-ziaaa-aaaaq-aabeq-cai/transaction/${blockIndex}`;
          break;
        case "GLDGov":
            link = `https://dashboard.internetcomputer.org/sns/tw2vt-hqaaa-aaaaq-aab6a-cai/transaction/${blockIndex}`;
          break;
        case "OWL":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "OGY":
            link = `https://dashboard.internetcomputer.org/sns/leu43-oiaaa-aaaaq-aadgq-cai/transaction/${blockIndex}`;
          break;
        case "FPL":
            link = `https://dashboard.internetcomputer.org/sns/gyito-zyaaa-aaaaq-aacpq-cai/transaction/${blockIndex}`;
          break;
        case "DITTO":
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
        case "ICVC": 
            link = `https://dashboard.internetcomputer.org/sns/nuywj-oaaaa-aaaaq-aadta-cai/transaction/${blockIndex}`;
          break;
        case "GLDT":
            link = `https://dashboard.internetcomputer.org/sns/6c7su-kiaaa-aaaar-qaira-cai/transaction/${blockIndex}`;
          break;
        default:
            link = `https://dashboard.internetcomputer.org/canister/${canisterId}#get_transactions`;
          break;
      }
  
      // Add to the accumulator as an object with symbol as key and link as value
      acc.push({ [symbol]: link });
      return acc;
    }, []);
  };