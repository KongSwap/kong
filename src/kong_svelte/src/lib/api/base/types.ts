/**
 * Common API types for use across all API clients
 */

/**
 * Base pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Base pagination response
 */
export interface PaginationResponse {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

/**
 * Base API error
 */
export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Base API response with pagination
 */
export interface PaginatedApiResponse<T> extends PaginationResponse {
  items: T[];
}

/**
 * Base API response for a single item
 */
export interface SingleItemApiResponse<T> {
  item: T;
}

/**
 * Base API response for a collection of items without pagination
 */
export interface CollectionApiResponse<T> {
  items: T[];
} 