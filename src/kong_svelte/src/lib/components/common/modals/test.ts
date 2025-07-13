/**
 * Quick test to verify the modal system is properly set up
 */

import { modalManager, modals } from './index';

// Test the modal manager API
export function testModalSystem() {
  console.log('Testing modal system...');
  
  // Test basic manager functionality
  console.log('Modal manager available:', !!modalManager);
  console.log('Modals helper available:', !!modals);
  console.log('Initial modal count:', modalManager.getOpenCount());
  console.log('Performance metrics:', modalManager.getPerformanceMetrics());
  
  return true;
}

// Export for potential runtime testing
if (typeof window !== 'undefined') {
  (window as any).testModalSystem = testModalSystem;
}