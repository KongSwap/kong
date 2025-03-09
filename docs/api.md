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

**Parameters:**
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

**Parameters:**
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

**Parameters:**
- `limit` (integer): Number of items to return
- `cursor` (string, optional): Pagination cursor for fetching next set of results

**Response:**
Similar to swap transactions but with liquidity-specific details.

### Get User Send Transactions
```
GET /api/users/{principalId}/transactions/send
```

Fetches send transactions for a specific user.

**Parameters:**
- `limit` (integer): Number of items to return
- `cursor` (string, optional): Pagination cursor for fetching next set of results

**Response:**
Similar to swap transactions but with send-specific details.

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
        "canister_id": "string",
        "symbol": "string"
      },
      "token1": {
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