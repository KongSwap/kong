#!/bin/bash

# Token Mining Economics Calculator
# This script helps calculate mining timelines and economics for your token

# Text formatting
BOLD='\033[1m'
NORMAL='\033[0m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'

# Function to validate numeric input
validate_number() {
    local input=$1
    local min=$2
    local max=$3
    local name=$4
    
    if ! [[ "$input" =~ ^[0-9]+$ ]] || [ "$input" -lt "$min" ] || [ "$input" -gt "$max" ]; then
        echo -e "${RED}Error: $name must be a number between $min and $max${NORMAL}"
        exit 1
    fi
}

# Function to format large numbers with commas
format_number() {
    printf "%'d" $1
}

# Function to convert seconds to human readable time
format_time() {
    local seconds=$1
    local days=$((seconds/86400))
    local hours=$(((seconds%86400)/3600))
    local minutes=$(((seconds%3600)/60))
    
    if [ "$days" -gt 365 ]; then
        local years=$((days/365))
        days=$((days%365))
        echo "$years years, $days days"
    else
        echo "$days days, $hours hours, $minutes minutes"
    fi
}

# Get user input with validation
echo -e "${BOLD}Token Mining Economics Calculator${NORMAL}\n"

read -p "Enter total token supply: " total_supply
validate_number "$total_supply" 1 1000000000000 "Total supply"

read -p "Enter desired mining timeframe in months (1-120): " timeframe_months
validate_number "$timeframe_months" 1 120 "Timeframe"

read -p "Enter target block time in seconds (10-600): " block_time
validate_number "$block_time" 10 600 "Block time"

echo -e "\n${BOLD}Calculating mining economics...${NORMAL}\n"

# Calculate basic metrics
blocks_until_halving=210000
timeframe_seconds=$((timeframe_months * 30 * 24 * 60 * 60))
total_blocks=$((timeframe_seconds / block_time))
block_reward=$((total_supply / total_blocks))

if [ $block_reward -eq 0 ]; then
    echo -e "${RED}Error: Mining timeframe too long for given supply and block time${NORMAL}"
    echo "This would result in a block reward less than 1 token"
    exit 1
fi

current_reward=$block_reward
total_mined=0
halving_number=0
seconds_per_halving=$((block_time * blocks_until_halving))

echo -e "${GREEN}Mining Timeline:${NORMAL}"
echo "----------------------------------------"

while [ $total_mined -lt $total_supply ] && [ $halving_number -lt 64 ]; do
    # Calculate tokens mined in this period
    tokens_this_period=$((blocks_until_halving * current_reward))
    
    # If this would exceed total supply, adjust
    if [ $((total_mined + tokens_this_period)) -gt $total_supply ]; then
        blocks_needed=$(( (total_supply - total_mined) / current_reward ))
        tokens_this_period=$((blocks_needed * current_reward))
        time_needed=$((blocks_needed * block_time))
        total_mined=$total_supply
    else
        time_needed=$seconds_per_halving
        total_mined=$((total_mined + tokens_this_period))
    fi
    
    # Calculate percentage mined
    percentage=$(( (total_mined * 100) / total_supply ))
    
    # Print period info
    echo -e "${YELLOW}Halving $halving_number:${NORMAL}"
    echo "Block reward: $(format_number $current_reward) tokens"
    echo "Time period: $(format_time $time_needed)"
    echo "Tokens mined: $(format_number $tokens_this_period)"
    echo "Total mined: $(format_number $total_mined) (${percentage}%)"
    echo "----------------------------------------"
    
    # Prepare for next period
    current_reward=$((current_reward / 2))
    halving_number=$((halving_number + 1))
    
    # Break if reward becomes 0
    if [ $current_reward -eq 0 ]; then
        break
    fi
done

# Calculate and display summary
blocks_per_month=$((2592000 / block_time)) # 2592000 seconds in a month
monthly_tokens=$((blocks_per_month * block_reward))

echo -e "\n${GREEN}Summary:${NORMAL}"
echo "----------------------------------------"
echo "Target timeframe: $timeframe_months months"
echo "Initial block reward: $(format_number $block_reward) tokens"
echo "Blocks per month: $(format_number $blocks_per_month)"
echo "Initial monthly mining rate: $(format_number $monthly_tokens) tokens"
echo "Number of halvings: $halving_number"

# Display warnings if needed
echo -e "\n${YELLOW}Notes:${NORMAL}"
if [ $monthly_tokens -gt $((total_supply / 12)) ]; then
    echo "- Warning: More than 1/12 of total supply mined per month initially"
fi
if [ $block_reward -gt $((total_supply / 1000)) ]; then
    echo "- Warning: Block reward might be too high relative to total supply"
fi
if [ $block_time -lt 30 ]; then
    echo "- Warning: Block time might be too short for network stability"
fi
