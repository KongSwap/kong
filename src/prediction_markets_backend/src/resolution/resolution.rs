//! # Market Resolution Types
//! 
//! This module defines the core data structures and types used in the market resolution process.
//! It includes resolution methods, error types, and the proposal structure used in the
//! dual-approval system for user-created markets.
//!
//! The resolution system supports multiple methods for determining market outcomes:
//! - Admin resolution (centralized by platform administrators)
//! - Oracle-based resolution (using trusted external data providers)
//! - Decentralized resolution (community-driven with staking requirements)
//!
//! The dual approval system requires both the market creator and an admin to agree on
//! the outcome for user-created markets, while admin-created markets can be resolved
//! directly by any admin.

use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

use crate::types::{MarketId, Timestamp, OutcomeIndex};

/// Represents a single vote in the dual resolution process
///
/// This structure captures who voted, what they voted for, when they voted,
/// and their role in the resolution process.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ResolutionVote {
    /// Principal ID of the voter
    pub voter: Principal,
    
    /// The outcome indices this voter proposed as winners
    pub proposed_outcomes: Vec<OutcomeIndex>,
    
    /// Timestamp when this vote was cast
    pub voted_at: Timestamp,
    
    /// The role/type of the voter
    pub voter_type: VoterType,
}

/// Identifies the type/role of a voter in the resolution process
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum VoterType {
    /// The market creator
    Creator,
    /// A platform administrator
    Admin,
}

/// Status of a resolution proposal based on current votes
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum ResolutionProposalStatus {
    /// Waiting for the market creator to cast their vote
    AwaitingCreatorVote,
    /// Waiting for an admin to cast their vote
    AwaitingAdminVote,
    /// Both parties have voted but their votes disagree
    VotesDisagree,
    /// Both parties have voted and their votes agree (ready for finalization)
    VotesAgree,
}

/// Public API representation of a resolution proposal
///
/// This structure provides a clean API view of the resolution proposal state,
/// including vote details and current status.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ResolutionProposalInfo {
    /// ID of the market this proposal is for
    pub market_id: MarketId,
    
    /// Vote cast by the market creator (if any)
    pub creator_vote: Option<ResolutionVote>,
    
    /// Vote cast by an admin (if any)
    pub admin_vote: Option<ResolutionVote>,
    
    /// Current status of the proposal based on votes received
    pub status: ResolutionProposalStatus,
    
    /// Timestamp when the proposal was first created
    pub created_at: Timestamp,
}

/// Defines how a market can be resolved
/// 
/// Different resolution methods provide flexibility in how market outcomes are determined,
/// from centralized admin resolution to more decentralized approaches.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum ResolutionMethod {
    /// Admin-based resolution where platform administrators determine the outcome
    /// This is the most common method used for official markets
    Admin, 
    
    /// Oracle-based resolution using external data providers
    /// Requires a specified number of oracle confirmations to finalize
    Oracle {
        /// Set of authorized principal IDs that can act as oracles for this market
        oracle_principals: BTreeSet<Principal>,
        
        /// Minimum number of oracle confirmations required to resolve the market
        /// Must be less than or equal to the number of oracle principals
        required_confirmations: candid::Nat,
    },
    
    /// Future decentralized resolution mechanism (not fully implemented)
    /// Will allow token holders to participate in resolution through staking
    Decentralized {
        /// Minimum amount of stake required to reach resolution consensus
        quorum: candid::Nat,
    },
}

/// Result type for market resolution operations
/// 
/// This enum distinguishes between successful resolution, intermediate states in
/// the dual approval flow, and actual error conditions.
#[derive(CandidType, Debug)]
pub enum ResolutionResult {
    /// Resolution was successful
    Success,
    
    /// Waiting for the market creator to approve the admin's proposal
    /// (admin has already approved) - part of the dual approval flow
    AwaitingCreatorApproval,
    
    /// Waiting for an admin to approve the creator's proposal
    /// (creator has already approved) - part of the dual approval flow
    AwaitingAdminApproval,
    
    /// An error occurred during the resolution process
    Error(ResolutionError),
}

/// Possible errors during market resolution
/// 
/// This enum defines all possible error conditions that can occur during
/// the resolution process, from authorization issues to technical failures.
#[derive(CandidType, Debug)]
pub enum ResolutionError {
    /// The caller is not authorized to perform this resolution action
    /// (not an admin, creator, or authorized oracle)
    Unauthorized,
    
    /// The specified market ID does not exist in the system
    MarketNotFound,
    
    /// The caller attempted to use a resolution method not compatible with this market
    InvalidMethod,
    
    /// The market's end time has not been reached yet
    /// Resolution can only happen after a market has closed for betting
    MarketStillOpen,
    
    /// The market has already been resolved or voided
    AlreadyResolved,
    
    /// The proposed winning outcome indices are invalid for this market
    /// (e.g., outcome index out of bounds)
    InvalidOutcome,
    
    /// Failed to update market status or other data during resolution
    UpdateFailed,
    
    /// Failed to process payouts to winning bettors
    PayoutFailed,
    
    /// Error occurred during token transfer operations
    /// Contains detailed error message from the token transfer system
    TransferError(String),
    
    /// Failed to void the market and refund bets
    VoidingFailed,
    
    /// For dual-approval resolution: waiting for the market creator to approve
    /// the proposed resolution (admin has already approved)
    AwaitingCreatorApproval,
    
    /// For dual-approval resolution: waiting for an admin to approve
    /// the proposed resolution (creator has already approved)
    AwaitingAdminApproval,
    
    /// For dual-approval resolution: the submitted resolution doesn't match
    /// the previously proposed resolution
    ResolutionMismatch,
    
    /// The market is in an invalid state for resolution
    /// (e.g., not in Active status)
    InvalidMarketStatus,
    
    /// For dual-approval resolution: admin and creator proposed different outcomes
    /// This results in the market being voided and creator's deposit being burned
    ResolutionDisagreement,
}

/// Represents a resolution proposal for a market with detailed vote tracking
/// 
/// This structure tracks the state of the dual-approval resolution process.
/// For user-created markets, both the creator and an admin must agree on the
/// resolution outcome. This enhanced version tracks detailed voting information
/// including who voted for what and when.
/// 
/// The dual-approval flow works as follows:
/// 1. Either the creator or an admin proposes a resolution (creating this record)
/// 2. The other party must then approve the same resolution
/// 3. If both approve the same outcomes, the market is finalized with those outcomes
/// 4. If they disagree (propose different outcomes), the market is voided
///    and the creator's deposit is burned
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ResolutionProposal {
    /// ID of the market this proposal is for
    pub market_id: MarketId,
    
    /// Vote cast by the market creator (if any)
    pub creator_vote: Option<ResolutionVote>,
    
    /// Vote cast by an admin (if any)
    pub admin_vote: Option<ResolutionVote>,
    
    /// Principal ID of the market creator
    pub creator: Principal,
    
    /// Timestamp when this proposal was first created
    pub proposed_at: Timestamp,
    
    // Legacy fields for backward compatibility
    /// The outcome indices proposed as winners (legacy - use votes instead)
    #[deprecated(since = "1.2.0", note = "Use creator_vote and admin_vote instead")]
    pub proposed_outcomes: Vec<OutcomeIndex>,
    
    /// Whether the market creator has approved this resolution (legacy)
    #[deprecated(since = "1.2.0", note = "Use creator_vote instead")]
    pub creator_approved: bool,
    
    /// Whether an admin has approved this resolution (legacy)
    #[deprecated(since = "1.2.0", note = "Use admin_vote instead")]
    pub admin_approved: bool,
    
    /// Principal ID of the admin who approved (legacy)
    #[deprecated(since = "1.2.0", note = "Use admin_vote.voter instead")]
    pub admin_approver: Option<Principal>,
}

impl ResolutionProposal {
    /// Determines the current status of this proposal based on the votes received
    pub fn get_status(&self) -> ResolutionProposalStatus {
        match (&self.creator_vote, &self.admin_vote) {
            (None, None) => ResolutionProposalStatus::AwaitingCreatorVote, // Default to creator first
            (Some(_), None) => ResolutionProposalStatus::AwaitingAdminVote,
            (None, Some(_)) => ResolutionProposalStatus::AwaitingCreatorVote,
            (Some(creator_vote), Some(admin_vote)) => {
                if creator_vote.proposed_outcomes == admin_vote.proposed_outcomes {
                    ResolutionProposalStatus::VotesAgree
                } else {
                    ResolutionProposalStatus::VotesDisagree
                }
            }
        }
    }
    
    /// Converts this proposal to the public API representation
    pub fn to_info(&self) -> ResolutionProposalInfo {
        ResolutionProposalInfo {
            market_id: self.market_id.clone(),
            creator_vote: self.creator_vote.clone(),
            admin_vote: self.admin_vote.clone(),
            status: self.get_status(),
            created_at: self.proposed_at.clone(),
        }
    }
    
    /// Checks if the proposal has votes that agree on the outcome
    pub fn votes_agree(&self) -> bool {
        matches!(self.get_status(), ResolutionProposalStatus::VotesAgree)
    }
    
    /// Checks if the proposal has votes that disagree on the outcome
    pub fn votes_disagree(&self) -> bool {
        matches!(self.get_status(), ResolutionProposalStatus::VotesDisagree)
    }
    
    /// Gets the agreed-upon outcomes if both parties have voted and agree
    pub fn get_agreed_outcomes(&self) -> Option<Vec<OutcomeIndex>> {
        if self.votes_agree() {
            // Both votes exist and agree, return either one (they're the same)
            self.creator_vote.as_ref()
                .or(self.admin_vote.as_ref())
                .map(|vote| vote.proposed_outcomes.clone())
        } else {
            None
        }
    }
}

impl Storable for ResolutionProposal {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = vec![];
        ciborium::ser::into_writer(self, &mut bytes).unwrap();
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
