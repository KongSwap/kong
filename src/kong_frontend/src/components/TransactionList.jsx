import React, { useState, useCallback, useMemo, useEffect } from "react";
import { FiExternalLink } from "react-icons/fi"; // External Link
import Pagination from "@mui/material/Pagination"; // MUI Pagination Component
import Stack from "@mui/material/Stack"; // MUI Stack for pagination positioning
import { priceRoundedAmount } from "../utils/numberUtils"; // Helper function to round the price
import BigNumber from "bignumber.js"; // BigNumber library for handling large numbers
import { getExplorerLinks } from "../utils/getExplorerLink"; // Helper function to generate explorer links

const TransactionList = ({
  transactions,
  tokenDetails,
  tokenImages,
  tokenPrices,
}) => {
  const [page, setPage] = useState(1); // Track the current page
  const [explorerLinks, setExplorerLinks] = useState([]); // New state for explorer links
  const transactionsPerPage = 12; // Number of transactions per page

  const getTokenDecimals = useCallback(
    (tokenSymbol) => {
      if (!tokenDetails || !tokenSymbol) return null;

      // Remove the chain part (like 'IC.') from the token symbol
      const cleanedSymbol = tokenSymbol.includes(".")
        ? tokenSymbol.split(".")[1]
        : tokenSymbol;

      // Loop through each token object in the tokenDetails array
      for (const tokenObj of tokenDetails) {
        // Get the first key of the object to access the token details
        const tokenKey = Object.keys(tokenObj)[0];
        const token = tokenObj[tokenKey];

        // Check if the symbol matches the cleaned tokenSymbol
        if (token.symbol === cleanedSymbol) {
          return token.decimals;
        }
      }

      return 8; // Default to 8 if the token is not found, adjust if necessary
    },
    [tokenDetails]
  );

  // Calculate the number of pages
  const pageCount = useMemo(
    () => Math.ceil(transactions.length / transactionsPerPage),
    [transactions.length]
  );

  // Get the transactions for the current page
  const currentTransactions = useMemo(
    () =>
      transactions.slice(
        (page - 1) * transactionsPerPage,
        page * transactionsPerPage
      ),
    [page, transactions]
  );

  // Handle page change
  const handlePageChange = useCallback((event, value) => {
    setPage(value);
  }, []);

  // new BigNumber(token.balance).toFormat(8)

  // Updated `generateTransactionMessage` function
  const generateTransactionMessage = useCallback(
    (transaction) => {
      const [type, data] = Object.entries(transaction)[0]; // Get the type and the data from the transaction object
      const {
        symbol,
        receive_symbol,
        pay_symbol,
        pay_amount,
        receive_amount,
        add_lp_token_amount,
        remove_lp_token_amount,
        symbol_0,
        symbol_1,
        amount_0,
        amount_1,
      } = data;

      const pay_symbol_final = pay_symbol || symbol_0; // Use symbol_0 if pay_symbol is not available
      const receive_symbol_final = receive_symbol || symbol_1; // Use symbol_1 if receive_symbol is not available

      // Construct the pool names for looking up tokenPrices
      const pay_pool_name = `${pay_symbol_final}_ckUSDT`; // Assuming "ckUSDT" is the main pairing
      const receive_pool_name = `${receive_symbol_final}_ckUSDT`;
      const lp_pool_name = `${symbol}_ckUSDT`;

      const payDecimals = getTokenDecimals(pay_symbol_final); // Get decimals for the pay token
      const receiveDecimals = getTokenDecimals(receive_symbol_final); // Get decimals for the receive token

      // Format the message based on the transaction type
      if (type === "Swap") {
        return `${priceRoundedAmount(
          tokenPrices[pay_pool_name],
          Number(pay_amount) / 10 ** payDecimals
        )} ${pay_symbol_final} to ${priceRoundedAmount(
          tokenPrices[receive_pool_name],
          Number(receive_amount) / 10 ** receiveDecimals
        )} ${receive_symbol_final}`;
      } else if (type === "AddLiquidity") {
        const decimals = getTokenDecimals(symbol); // Get decimals for the LP token
        return `Added ${new BigNumber(
          Number(add_lp_token_amount) / 10 ** decimals
        ).toFormat(8)} ${symbol} LP Tokens for ${priceRoundedAmount(
          tokenPrices[pay_pool_name],
          Number(amount_0) / 10 ** payDecimals
        )} ${pay_symbol_final} and ${priceRoundedAmount(
          tokenPrices[pay_pool_name],
          Number(amount_1) / 10 ** receiveDecimals
        )} ${receive_symbol_final}`;
      } else if (type === "RemoveLiquidity") {
        const decimals = getTokenDecimals(symbol); // Get decimals for the LP token
        return `Removed ${new BigNumber(
          Number(remove_lp_token_amount) / 10 ** decimals
        ).toFormat(8)} ${symbol} LP Tokens for ${priceRoundedAmount(
          tokenPrices[pay_pool_name],
          Number(amount_0) / 10 ** payDecimals
        )} ${pay_symbol_final} and ${priceRoundedAmount(
          tokenPrices[receive_pool_name],
          Number(amount_1) / 10 ** receiveDecimals
        )} ${receive_symbol_final}`;
      }
      return "";
    },
    [getTokenDecimals, tokenPrices]
  );

  // Function to render the correct icon based on transaction type
  const renderTransactionIcon = useCallback((type) => {
    // if (type === 'Swap') return <RiExchangeFundsLine size={36} />;
    // if (type === 'AddLiquidity') return <IoMdAddCircleOutline size={36} />;
    // if (type === 'RemoveLiquidity') return <IoMdRemoveCircleOutline size={36} />;
    if (type === "Swap")
      return (
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M13 20H14V22H13V23H12V24H6V22H12V21H13V20Z" fill="black" />
          <path
            d="M26 21H27V23H26V24H25V25H24V26H23V23H19V22H18V21H17V19H16V18H15V16H14V15H13V13H12V12H6V10H13V11H14V13H15V15H16V16H17V18H18V19H19V21H23V18H24V19H25V20H26V21Z"
            fill="black"
          />
          <path
            d="M27 10V12H26V13H25V14H24V15H23V12H19V13H18V14H17V12H18V11H19V10H23V7H24V8H25V9H26V10H27Z"
            fill="black"
          />
          <circle cx="17" cy="17" r="16" stroke="black" stroke-width="2" />
        </svg>
      );
    if (type === "AddLiquidity")
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="16" cy="16" r="15" stroke="black" stroke-width="2" />
          <g clip-path="url(#clip0_1370_360729)">
            <path
              d="M19.334 12.6663V10.9997H18.5007V9.33301H17.6673V7.66634H16.834V6.83301H15.1673V7.66634H14.334V9.33301H13.5007V10.9997H12.6673V12.6663H6.83398V14.333H7.66732V15.1663H8.50065V15.9997H9.33398V16.833H10.1673V17.6663H11.0007V21.833H10.1673V25.1663H11.834V24.333H13.5007V23.4997H15.1673V22.6663H16.834V23.4997H18.5007V24.333H20.1673V25.1663H21.834V21.833H21.0006V17.6663H21.834V16.833H22.6673V15.9997H23.5006V15.1663H24.334V14.333H25.1673V12.6663H19.334ZM22.6673 15.1663H21.834V15.9997H21.0006V16.833H20.1673V17.6663H19.334V21.833H20.1673V22.6663H18.5007V21.833H16.834V20.9997H15.1673V21.833H13.5007V22.6663H11.834V21.833H12.6673V17.6663H11.834V16.833H11.0007V15.9997H10.1673V15.1663H9.33398V14.333H12.6673V13.4997H13.5007V12.6663H14.334V10.9997H15.1673V9.33301H16.834V10.9997H17.6673V12.6663H18.5007V13.4997H19.334V14.333H22.6673V15.1663Z"
              fill="black"
            />
          </g>
          <defs>
            <clipPath id="clip0_1370_360729">
              <rect
                width="20"
                height="20"
                fill="white"
                transform="translate(6 6)"
              />
            </clipPath>
          </defs>
        </svg>
      );
    if (type === "RemoveLiquidity")
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M14.5 10H13V10.75H12.25V11.5H11.5V12.25H10.75V13H10V13.75H9.25V14.5H8.5V15.25H7.75V16.75H8.5V17.5H9.25V18.25H10V19H10.75V19.75H11.5V20.5H12.25V21.25H13V22H14.5V20.5H13.75V19.75H13V19H12.25V18.25H11.5V17.5H10.75V16.75H19.75V15.25H10.75V14.5H11.5V13.75H12.25V13H13V12.25H13.75V11.5H14.5V10Z"
            fill="black"
          />
          <path d="M22.75 8.5H24.25V23.5H22.75V8.5Z" fill="black" />
          <circle
            cx="16"
            cy="16"
            r="15"
            transform="matrix(-1 0 0 1 32 0)"
            stroke="black"
            stroke-width="2"
          />
        </svg>
      );
    if (type === "SendLiquidity")
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.5 10H19V10.75H19.75V11.5H20.5V12.25H21.25V13H22V13.75H22.75V14.5H23.5V15.25H24.25V16.75H23.5V17.5H22.75V18.25H22V19H21.25V19.75H20.5V20.5H19.75V21.25H19V22H17.5V20.5H18.25V19.75H19V19H19.75V18.25H20.5V17.5H21.25V16.75H12.25V15.25H21.25V14.5H20.5V13.75H19.75V13H19V12.25H18.25V11.5H17.5V10Z"
            fill="black"
          />
          <path d="M9.25 8.5H7.75V23.5H9.25V8.5Z" fill="black" />
          <circle cx="16" cy="16" r="15" stroke="black" stroke-width="2" />
        </svg>
      );
    if (type === "ApproveLiquidity")
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24.3327 9.33301V10.9997H23.4993V11.833H22.666V12.6663H21.8327V13.4997H20.9993V14.333H20.166V15.1663H19.3327V15.9997H18.4993V16.833H17.666V17.6663H16.8327V18.4997H15.9993V19.333H15.166V20.1663H14.3327V20.9997H12.666V20.1663H11.8327V19.333H10.9993V18.4997H10.166V17.6663H9.33268V16.833H8.49935V15.9997H7.66602V14.333H9.33268V15.1663H10.166V15.9997H10.9993V16.833H11.8327V17.6663H12.666V18.4997H14.3327V17.6663H15.166V16.833H15.9993V15.9997H16.8327V15.1663H17.666V14.333H18.4993V13.4997H19.3327V12.6663H20.166V11.833H20.9993V10.9997H21.8327V10.1663H22.666V9.33301H24.3327Z"
            fill="black"
          />
          <circle cx="16" cy="16" r="15" stroke="black" stroke-width="2" />
        </svg>
      );
    return null;
  }, []);

  // Function to render the correct title based on transaction type
  const renderTransactionTitle = useCallback((type) => {
    if (type === "Swap") return "Swap";
    if (type === "AddLiquidity") return "Add Liquidity";
    if (type === "RemoveLiquidity") return "Remove Liquidity";
    return ""; // Ignore other types
  }, []);

  // Function to open block in a new tab
  const openBlockLink = useCallback((block_id, principal_id) => {
    const url = `https://dashboard.internetcomputer.org/sns/${principal_id}/transaction/${block_id}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const getTokenImage = useCallback(
    (symbol) => {
      if (!symbol || !tokenImages) return null;
      return tokenImages[symbol] || null; // Get the corresponding image if available
    },
    [tokenImages]
  );

  if (!transactions || transactions.length === 0) {
    return <div className="no-activity">No transactions found</div>;
  }

  useEffect(() => {
    if (transactions && transactions.length > 0) {
      const links = transactions.map((transaction) => {
        const [type, data] = Object.entries(transaction)[0]; // Get the transaction type and data
        return data.transfer_ids ? getExplorerLinks(data.transfer_ids) : [];
      });
      setExplorerLinks(links); // Set the state with the generated links
    }
  }, [transactions]);

  return (
    <>
      <div className="activity-list">
        {currentTransactions.length > 0 &&
          currentTransactions.map((transaction, index) => {
            const [type, data] = Object.entries(transaction)[0]; // Extract transaction type and data
            const { block_ids } = data; // Extract block_ids and symbol from the data
            const links = explorerLinks[index] || []; // Get the links for the current transaction

            // Ignore unknown or unsupported transaction types
            if (!["Swap", "AddLiquidity", "RemoveLiquidity"].includes(type))
              return null;

            return (
              <div className="activity-item" key={index}>
                <span className="activity-logo-wrapper">
                  {renderTransactionIcon(type)}
                </span>
                <span className="activity-details">
                  <span className="activity-toprow">
                    <span className="activity-name">
                      {renderTransactionTitle(type)}
                    </span>
                  </span>
                  <span className="activity-descriptor">
                    {generateTransactionMessage(transaction)}
                  </span>
                </span>
                {/* <span className="activity-external-links">
                {links && links.length > 0 && 
                  links.map((linkObj, idx) => (
                    Object.entries(linkObj).map(([symbol, link]) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', cursor: "pointer", textDecoration: 'none' }}
                      >
                        {symbol} Explorer <FiExternalLink size={24} className='external-icon' />
                      </a>
                    ))
                  ))
                }
              </span> */}
                <span className="activity-external-links">
                  {links &&
                    links.length > 0 &&
                    links.map((linkObj, idx) => {
                      const [symbol, link] = Object.entries(linkObj)[0]; // Get the symbol and link directly

                      return (
                        <span
                          key={idx}
                          className="activity-external-link"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                          }} // Style the link as a button
                          onClick={() =>
                            window.open(link, "_blank", "noopener,noreferrer")
                          }
                        >
                          {/* Show token icon if available */}
                          {symbol && (
                            <img
                              src={getTokenImage(symbol)}
                              alt={symbol}
                              style={{ width: "2rem", height: "2rem" }}
                            />
                          )}
                          {/* <FiExternalLink size={24} className='external-icon' /> */}
                        </span>
                      );
                    })}
                </span>
              </div>
            );
          })}
      </div>

      {/* Pagination Component */}
      <Stack
        spacing={2}
        justifyContent="center"
        alignItems="center"
        sx={{ marginTop: 4 }}
      >
        <Pagination
          count={pageCount}
          page={page}
          onChange={handlePageChange}
          sx={{
            "& .MuiPaginationItem-root": {
              fontSize: "18px", // Adjust the font size here
            },
          }}
        />
      </Stack>
    </>
  );
};

export default TransactionList;
