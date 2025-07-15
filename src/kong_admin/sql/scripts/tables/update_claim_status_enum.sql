-- Add missing enum values to claim_status
ALTER TYPE claim_status ADD VALUE 'UnclaimedOverride';
ALTER TYPE claim_status ADD VALUE 'Claimable'; 