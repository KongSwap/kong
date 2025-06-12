// User.ts
// Model for user data with principal ID cleaning

import { BaseModel } from './BaseModel';
import { truncateAddress } from '$lib/utils/principalUtils';

export class User extends BaseModel {
  /**
   * Cleans a principal ID by removing '-2' suffix if present
   * @param principalId - The principal ID to clean
   * @returns Cleaned principal ID
   */
  static cleanPrincipalId(principalId: string): string {
    if (!principalId) return '';
    return principalId.endsWith('-2') ? principalId.slice(0, -2) : principalId;
  }

  /**
   * Serializes a user object including cleaning the principal ID
   * @param user - The raw user object
   * @returns Serialized user with cleaned principal ID
   */
  static serializeUser(user: unknown): any {
    if (!user || typeof user !== 'object') return null;
    
    const userData = user as Record<string, unknown>;
    const principalId = this.toString(userData.principal_id);
    
    return {
      ...userData,
      principal_id: this.cleanPrincipalId(principalId),
      // Add any other user properties that need serialization here
    };
  }

  /**
   * Serializes an array of users
   * @param users - Array of raw user objects
   * @returns Array of serialized users with cleaned principal IDs
   */
  static serializeUsers(users: unknown[]): any[] {
    if (!Array.isArray(users)) return [];
    
    return users.map(user => this.serializeUser(user));
  }

  /**
   * Serializes a user response object that contains items array
   * @param response - The raw API response containing users
   * @returns Serialized response with cleaned user principal IDs
   */
  static serializeUsersResponse(response: unknown): any {
    if (!response || typeof response !== 'object') return { items: [] };
    
    const data = response as Record<string, unknown>;
    
    if (Array.isArray(data.items)) {
      return {
        ...data,
        items: this.serializeUsers(data.items)
      };
    }
    
    return data;
  }
} 