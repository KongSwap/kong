# Kong API Documentation

This document provides a comprehensive overview of all Kong API endpoints available for integration.

## Base URLs

The base URL for all Kong API endpoints varies by environment:
- **Production**: `https://api.kongswap.io`
- **Staging**: `https://clownfish-app-2dvg3.ondigitalocean.app`
- **Local**: `http://localhost:8080`

## 1. Token Endpoints

### Get Tokens List
```
GET /api/tokens
```

Fetches a list of tokens with pagination, search, and filtering options.

**Parameters:**
- `page` (integer): Page number for pagination
- `limit` (integer): Number of items per page
- `search` (string): Search term to filter tokens
- `canister_id` (string): Filter by specific canister ID

**Response:**
```json
{
  "items": [
    {
      "token_id": 1,
      "canister_id": "string",
      "name": "string",
      "symbol": "string",
      "decimals": 8,
      "fee": "string",
      "metrics": {
        "price": "string",
        "volume_24h": "string",
        "total_supply": "string",
        "market_cap": "string",
        "tvl": "string",
        "updated_at": "string",
        "price_change_24h": "string"
      }
    }
  ],
  "total_count": 0
}
```

### Get Tokens by Canister IDs
```
POST /api/tokens/by_canister
```

Fetches tokens by a list of canister IDs.

**Request Body:**
```json
{
  "canister_ids": ["id1", "id2", "..."]
}
```

**Response:**
Same format as Get Tokens List.

### Get Token Transactions
```
GET /api/tokens/{tokenId}/transactions
```

Fetches transactions for a specific token.

**Path Parameters:**
- `tokenId` (integer): ID of the token

**Query Parameters:**
- `page` (integer): Page number for pagination
- `limit` (integer): Number of items per page

**Response:**
```json
{
  "items": [
    {
      "tx_id": "string",
      "tx_type": "string",
      "timestamp": "string",
      "status": "string",
      "details": {
        // Transaction-specific details
      }
    }
  ]
}
```

## 2. User Endpoints

### Get Users
```
GET /api/users
```

Fetches users with optional filtering by principal ID.

**Parameters:**
- `principal_id` (string, optional): Filter by principal ID

**Response:**
```json
{
  "items": [
    {
      "user_id": 0,
      "principal_id": "string",
      "my_referral_code": "string",
      "referred_by": "string",
      "fee_level": 0
    }
  ],
  "next_cursor": "string",
  "has_more": false,
  "limit": 0
}
```

### Get User Swap Transactions
```
GET /api/users/{principalId}/transactions/swap
```

Fetches swap transactions for a specific user.

**Path Parameters:**
- `principalId` (string): Principal ID of the user

**Query Parameters:**
- `limit` (integer): Number of items to return
- `cursor` (string, optional): Pagination cursor for fetching next set of results

**Response:**
```json
{
  "transactions": [
    {
      "tx_id": "string",
      "tx_type": "swap",
      "status": "string",
      "timestamp": "string",
      "details": {
        "pay_amount": "string",
        "receive_amount": "string",
        "pay_token_id": "string",
        "receive_token_id": "string",
        "pay_token_symbol": "string",
        "receive_token_symbol": "string",
        "pool_id": "string",
        "price": "string",
        "slippage": "string"
      }
    }
  ],
  "has_more": false,
  "next_cursor": "string"
}
```

### Get User Liquidity Transactions
```
GET /api/users/{principalId}/transactions/liquidity
```

Fetches liquidity transactions (add/remove) for a specific user.

**Path Parameters:**
- `principalId` (string): Principal ID of the user

**Query Parameters:**
- `limit` (integer): Number of items to return
- `cursor` (string, optional): Pagination cursor for fetching next set of results

**Response:**
```json
{
  "transactions": [
    {
      "tx_id": "string",
      "tx_type": "add_liquidity | remove_liquidity",
      "status": "string",
      "timestamp": "string",
      "details": {
        "pool_id": "string",
        "pool_name": "string",
        "token0_symbol": "string",
        "token1_symbol": "string",
        "amount0": "string",
        "amount1": "string",
        "lp_token_amount": "string"
      }
    }
  ],
  "has_more": false,
  "next_cursor": "string"
}
```

### Get User Send Transactions
```
GET /api/users/{principalId}/transactions/send
```

Fetches send transactions for a specific user.

**Path Parameters:**
- `principalId` (string): Principal ID of the user

**Query Parameters:**
- `limit` (integer): Number of items to return
- `cursor` (string, optional): Pagination cursor for fetching next set of results

**Response:**
```json
{
  "transactions": [
    {
      "tx_id": "string",
      "tx_type": "send",
      "status": "string",
      "timestamp": "string",
      "details": {
        "token_id": "string",
        "token_symbol": "string",
        "amount": "string",
        "recipient": "string"
      }
    }
  ],
  "has_more": false,
  "next_cursor": "string"
}
```

## 3. Pool Endpoints

### Get Pools
```
GET /api/pools
```

Fetches a list of pools with pagination, search, and filtering options.

**Parameters:**
- `page` (integer): Page number for pagination
- `limit` (integer): Number of items per page
- `search` (string): Search term to filter pools

**Response:**
```json
{
  "pools": [
    {
      "pool_id": "string",
      "token0": {
        "token_id": 1,
        "canister_id": "string",
        "symbol": "string"
      },
      "token1": {
        "token_id": 2,
        "canister_id": "string",
        "symbol": "string"
      },
      "tvl": "string",
      "volume_24h": "string",
      "fee": "string"
    }
  ],
  "total_count": 0,
  "total_pages": 0,
  "page": 0,
  "limit": 0
}
```

### Get Pools by Canister IDs
```
POST /api/pools
```

Fetches pools by a list of canister IDs.

**Request Body:**
```json
{
  "canister_ids": ["id1", "id2", "..."]
}
```

**Response:**
Same format as Get Pools.

### Get Pool Balance History
```
GET /api/pools/{poolId}/balance-history
```

Fetches balance history for a specific pool.

**Path Parameters:**
- `poolId` (integer): ID of the pool

**Response:**
```json
[
  {
    "timestamp": "string",
    "balance_0": "string",
    "balance_1": "string"
  }
]
```

### Get Pool Totals
```
GET /api/pools/totals
```

Fetches aggregate pool statistics.

**Response:**
```json
{
  "total_volume_24h": 0,
  "total_tvl": 0,
  "total_fees_24h": 0
}
```

## 4. Swap/Chart Endpoints

### Get OHLC Data
```
GET /api/swaps/ohlc
```

Fetches OHLC (candlestick) data for token pairs.

**Parameters:**
- `pay_token_id` (integer): ID of the token being paid
- `receive_token_id` (integer): ID of the token being received
- `start_time` (string): Start time in ISO format
- `end_time` (string): End time in ISO format
- `interval` (string): Time interval (1m, 5, 15, 30, 1h, 4h, 1d, 1w)

**Response:**
```json
[
  {
    "candle_start": 0,
    "open_price": "string",
    "high_price": "string",
    "low_price": "string",
    "close_price": "string",
    "volume": "string"
  }
]
```

## 5. Token Terminal Endpoints

These endpoints provide metrics for the Token Terminal platform integration.

### Get Current Metrics
```
GET /api/tt/metrics
```

Fetches current protocol-wide metrics for Token Terminal.

**Response:**
```json
{
  "protocol": "KongSwap",
  "chain": "Internet Computer",
  "timestamp": "2025-03-19T17:47:07.237115Z",
  "tvl_usd": 132985071985.0,
  "daily_volume_usd": 14994006.0,
  "daily_fees_usd": 44981.0,
  "daily_revenue_usd": 7511.827,
  "daily_active_users": 0,
  "daily_trade_count": 0
}
```

### Get Pool Data
```
GET /api/tt/pools
```

Fetches all pool data for Token Terminal.

**Response:**
```json
{
  "protocol": "KongSwap",
  "chain": "Internet Computer",
  "timestamp": "2025-03-19T17:47:12.440727Z",
  "pools": [
    {
      "pool_id": 1,
      "pool_name": "ksUSDT/ksICP",
      "tvl_usd": 74985071985.0,
      "daily_volume_usd": 14994006.0,
      "daily_fees_usd": 44981.0
    }
  ]
}
```

### Get Historical Volume Data
```
GET /api/tt/volume
```

Fetches historical daily volume data.

**Parameters:**
- `start_time` (integer, optional): Start timestamp in seconds (defaults to 30 days ago)
- `end_time` (integer, optional): End timestamp in seconds (defaults to current time)

**Response:**
```json
{
  "protocol": "KongSwap",
  "chain": "Internet Computer",
  "data": [
    {
      "date": "2025-03-19",
      "volume_usd": 14994006.0
    }
  ]
}
```

### Get Historical Fees Data
```
GET /api/tt/fees
```

Fetches historical daily fees data.

**Parameters:**
- `start_time` (integer, optional): Start timestamp in seconds (defaults to 30 days ago)
- `end_time` (integer, optional): End timestamp in seconds (defaults to current time)

**Response:**
```json
{
  "protocol": "KongSwap",
  "chain": "Internet Computer",
  "data": [
    {
      "date": "2025-03-19",
      "fees_usd": 44981.0,
      "revenue_usd": 7511.827
    }
  ]
}
```

### Get Historical User Metrics
```
GET /api/tt/users/metrics
```

Fetches historical daily user metrics.

**Parameters:**
- `start_time` (integer, optional): Start timestamp in seconds (defaults to 30 days ago)
- `end_time` (integer, optional): End timestamp in seconds (defaults to current time)

**Response:**
```json
{
  "protocol": "KongSwap",
  "chain": "Internet Computer",
  "data": [
    {
      "date": "2025-03-19",
      "active_users": 24,
      "transactions": 85
    }
  ]
}
```

## 6. GeckoTerminal Endpoints

Endpoints that provide data for GeckoTerminal integration.

### Get Latest Block
```
GET /api/gecko/latest-block
```

Fetches information about the latest block.

**Response:**
```json
{
  "block": {
    "blockNumber": 100,
    "blockTimestamp": 1698126147
  }
}
```

### Get Asset Info
```
GET /api/gecko/asset
```

Fetches detailed information about a specific asset.

**Parameters:**
- `id` (string): Asset ID (canister ID for IC tokens)

**Response:**
```json
{
  "asset": {
    "id": "ryjl3-tyaaa-aaaaa-aaaba-cai",
    "name": "Internet Computer",
    "symbol": "ICP",
    "decimals": 8,
    "total_supply": "10000000",
    "circulating_supply": "9000000",
    "coin_gecko_id": "internet-computer"
  }
}
```

### Get Pair Info
```
GET /api/gecko/pair
```

Fetches detailed information about a specific trading pair.

**Parameters:**
- `id` (string): Pair ID

**Response:**
```json
{
  "pair": {
    "id": "1",
    "dexKey": "kong",
    "asset0Id": "ryjl3-tyaaa-aaaaa-aaaba-cai",
    "asset1Id": "5iop7-gyaaa-aaaaq-qaada-cai",
    "createdAtBlockNumber": 1,
    "createdAtBlockTimestamp": 1675181147,
    "createdAtTxnId": "1",
    "creator": "2vxsx-fae",
    "feeBps": 30
  }
}
```

### Get Events
```
GET /api/gecko/events
```

Fetches swap, join, and exit events within a block range.

**Parameters:**
- `from_block` (integer, optional): Starting block number
- `to_block` (integer, optional): Ending block number

**Response:**
```json
{
  "events": [
    {
      "block": {
        "blockNumber": 100,
        "blockTimestamp": 1698126147
      },
      "eventType": "swap",
      "txnId": "1",
      "txnIndex": 0,
      "eventIndex": 0,
      "maker": "2vxsx-fae",
      "pairId": "1",
      "asset0In": 10.5,
      "asset1Out": 5.25,
      "priceNative": 0.5,
      "reserves": {
        "asset0": 100.0,
        "asset1": 50.0
      }
    }
  ]
}
```

## 7. Leaderboard Endpoints

### Get Top Traders
```
GET /api/leaderboard/top-traders
```

Fetches top traders by volume.

**Parameters:**
- `period` (string, optional): Time period for leaderboard. Valid values: "1d", "7d", "30d", "all". Default is "7d".
- `limit` (integer, optional): Number of traders to return. Default is 100.

**Response:**
```json
{
  "period": "7d",
  "leaders": [
    {
      "rank": 1,
      "principal_id": "string",
      "volume_usd": 1000000.0
    }
  ]
}
```

## 8. DexScreener Endpoints

Endpoints that provide data for DexScreener integration.

### Get Latest Block
```
GET /api/dexscreener/latest-block
```

Fetches information about the latest block.

**Response:**
```json
{
  "block": {
    "number": 100,
    "timestamp": "2024-03-20T12:34:56Z"
  }
}
```

### Get Asset Info
```
GET /api/dexscreener/asset
```

Fetches detailed information about a specific asset.

**Parameters:**
- `id` (string): Asset ID (canister ID for IC tokens)

**Response:**
```json
{
  "asset": {
    "id": "ryjl3-tyaaa-aaaaa-aaaba-cai",
    "name": "Internet Computer",
    "symbol": "ICP",
    "decimals": 8,
    "total_supply": "10000000",
    "circulating_supply": "9000000",
    "coin_gecko_id": "internet-computer"
  }
}
```

### Get Pair Info
```
GET /api/dexscreener/pair
```

Fetches detailed information about a specific trading pair.

**Parameters:**
- `id` (string): Pair ID

**Response:**
```json
{
  "pair": {
    "id": "1",
    "dexKey": "kong",
    "asset0Id": "ryjl3-tyaaa-aaaaa-aaaba-cai",
    "asset1Id": "5iop7-gyaaa-aaaaq-qaada-cai",
    "createdAtBlockNumber": 1,
    "createdAtBlockTimestamp": 1675181147,
    "createdAtTxnId": "1",
    "creator": "2vxsx-fae",
    "feeBps": 30
  }
}
```

### Get Events
```
GET /api/dexscreener/events
```

Fetches swap, join, and exit events within a block range.

**Parameters:**
- `fromBlock` (integer, optional): Starting block number
- `toBlock` (integer, optional): Ending block number
- `limit` (integer, optional, default=100): Maximum number of events to return
- `offset` (integer, optional, default=0): Number of events to skip

**Response:**
```json
{
  "events": [
    {
      "block": {
        "blockNumber": 100,
        "blockTimestamp": 1698126147
      },
      "eventType": "swap",
      "txnId": "1",
      "txnIndex": 0,
      "eventIndex": 0,
      "maker": "2vxsx-fae",
      "pairId": "1",
      "asset0In": 10.5,
      "asset1Out": 5.25,
      "priceNative": 0.5,
      "reserves": {
        "asset0": 100.0,
        "asset1": 50.0
      }
    }
  ]
}
```

### Get Pairs
```
GET /api/dexscreener/pairs
```

Fetches all trading pairs for DexScreener integration.

**Response:**
```json
{
  "schemaVersion": "1.0.0",
  "pairs": [
    {
      "chainId": "internetcomputer",
      "dexId": "kongswap",
      "url": "https://kongswap.io/swap?from=TOKEN0&to=TOKEN1",
      "pairAddress": "string",
      "baseToken": {
        "address": "string",
        "name": "string",
        "symbol": "string"
      },
      "quoteToken": {
        "address": "string",
        "name": "string",
        "symbol": "string"
      },
      "priceNative": "string",
      "priceUsd": "string",
      "txns": {
        "h24": {
          "buys": 0,
          "sells": 0
        },
        "h6": {
          "buys": 0,
          "sells": 0
        },
        "h1": {
          "buys": 0,
          "sells": 0
        }
      },
      "volume": {
        "h24": 0,
        "h6": 0,
        "h1": 0
      },
      "priceChange": {
        "h24": 0,
        "h6": 0,
        "h1": 0
      },
      "liquidity": {
        "usd": 0
      },
      "fdv": 0,
      "pairCreatedAt": 0
    }
  ]
}
```

### Get Tokens
```
GET /api/dexscreener/tokens
```

Fetches all tokens for DexScreener integration.

**Response:**
```json
{
  "schemaVersion": "1.0.0",
  "tokens": [
    {
      "chainId": "internetcomputer",
      "dexId": "kongswap",
      "address": "string",
      "name": "string",
      "symbol": "string",
      "priceUsd": "string",
      "liquidity": {
        "usd": 0
      },
      "volume": {
        "h24": 0
      },
      "priceChange": {
        "h24": 0
      },
      "txns": {
        "h24": {
          "buys": 0,
          "sells": 0
        }
      },
      "fdv": 0
    }
  ]
}
```

## 9. DefiLlama Endpoints

Endpoints that provide data for DefiLlama integration.

### Get TVL
```
GET /api/defillama/tvl
```

Fetches Total Value Locked (TVL) data for DefiLlama integration.

**Response:**
```json
{
  "tvl": 1000000,
  "tokens": [
    {
      "address": "string",
      "name": "string",
      "symbol": "string",
      "amount": 1000,
      "usdValue": 10000
    }
  ]
}
```

### Get Protocol TVL Data
```
GET /api/defillama/protocol
```

Fetches protocol data for DefiLlama integration.

**Response:**
```json
{
  "name": "KongSwap",
  "address": "string",
  "symbol": "KONG",
  "url": "https://kongswap.io",
  "description": "KongSwap is a decentralized exchange on the Internet Computer",
  "chain": "internetcomputer",
  "logo": "https://kongswap.io/logo.png",
  "audits": "yes",
  "audit_links": [
    "https://kongswap.io/audit"
  ],
  "gecko_id": "kongswap",
  "category": "DEX",
  "tvl": 1000000,
  "change_1h": 0,
  "change_1d": 0,
  "change_7d": 0
}
```

## 10. Health Endpoints

### Get Health Status
```
GET /health
```

Checks if the API is running and healthy.

**Response:**
```json
{
  "status": "healthy",
  "redis": {
    "available": true,
    "pooled_connections": 1,
    "active_connections": 0
  }
}
```

## Error Handling

All API endpoints follow a consistent error response format:

```json
{
  "error": "string",
  "message": "string",
  "status": 400
}
```

Common HTTP status codes:
- `200 OK`: Request successful
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error 