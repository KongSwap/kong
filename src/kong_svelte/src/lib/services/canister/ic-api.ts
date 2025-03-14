import { Principal } from '@dfinity/principal';
import { auth } from '$lib/services/auth';
import { idlFactory as cmcIdlFactory } from '$lib/services/canister/cmc.idl';

// IC API service for fetching network data
// This service provides a comprehensive interface to the Internet Computer Dashboard API v3
// Documentation: https://ic-api.internetcomputer.org/api/v3/swagger

// Types for API responses
export interface NodeMetrics {
  cpu_usage: number;
  memory_usage: number;
  network_bandwidth: number;
  uptime: number;
  last_seen: number;
}

export interface DataCenter {
  id: string;
  name: string;
  region: string;
  provider: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface NodeProvider {
  id: string;
  name: string;
  total_nodes: number;
  active_nodes: number;
}

export interface SubnetMetrics {
  message_execution_rate: number;
  block_rate: number;
  finalization_rate: number;
  transaction_success_rate: number;
  average_tps: number;
  peak_tps: number;
  cycles_burned_24h: number;
}

export interface SubnetHistoricalMetrics {
  daily_transaction_volume: number[];
  daily_active_canisters: number[];
  daily_cycles_burned: number[];
  timestamps: number[];
}

export interface Subnet {
  subnet_id: string;
  subnet_type: string;
  instruction_rate: number;
  memory_usage: number;
  message_execution_rate: number;
  nakamoto_coefficient_cities: number;
  display_name: string | null;
  // Additional fields for subnet metrics
  canister_count: number;
  max_canisters: number;
  node_count: number;
  replica_version: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  block_rate: number;
  memory_capacity: number; // in bytes
  geographic_distribution: string[]; // list of regions
  metrics?: SubnetMetrics;
  historical_metrics?: SubnetHistoricalMetrics;
  nodes?: NodeInfo[];
  data_centers?: DataCenter[];
  reliability_score?: number; // 0-100 score based on uptime and performance
  cost_efficiency_score?: number; // 0-100 score based on cycles burned and performance
  recommended_for?: string[]; // array of use cases this subnet is well-suited for
}

export interface NodeInfo {
  node_id: string;
  subnet_id: string;
  provider_id: string;
  data_center_id: string;
  status: 'active' | 'inactive' | 'faulty';
  metrics?: NodeMetrics;
}

export interface SubnetDetail extends Subnet {
  membership: string[];
  records?: number;
  performance_analysis?: {
    avg_block_rate_24h: number;
    avg_tps_24h: number;
    uptime_percentage_30d: number;
    latency_percentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    resource_utilization: {
      cpu_percentage: number;
      memory_percentage: number;
      storage_percentage: number;
    };
  };
  deployment_recommendations?: {
    suitable_for: string[];
    cautions: string[];
    estimated_costs: {
      cycles_per_day: number;
      usd_equivalent: number;
    };
  };
}

export interface ConversionRateResponse {
  icp_xdr_conversion_rates: [number, number][];
}

export interface ICPPriceResponse {
  icp_usd_rate: [number, string][];
}

export interface ICPPriceChange {
  icp_usd_percent_change_24h: number;
}

export interface ICPPrice {
  timestamp: number;
  usdPrice: string;
}

export interface ConversionRate {
  timestamp: number; 
  xdrRate: number;
}

interface SubnetsResponse {
  subnets: Subnet[];
}

// API configuration
const IC_API_BASE_URL = 'https://ic-api.internetcomputer.org/api/v3';

// Custom error class for API errors
class ICAPIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ICAPIError';
  }
}

// Helper function to validate API response data
function validateResponse<T>(data: any, endpoint: string): T {
  if (!data) {
    throw new ICAPIError('Empty response received', undefined, endpoint);
  }
  // Add more specific validation logic based on expected response type
  return data as T;
}

// Helper function to handle API responses with enhanced error handling
async function fetchFromIC<T>(endpoint: string): Promise<T> {
  const url = `${IC_API_BASE_URL}${endpoint}`;

  try {
    console.log(`Fetching from IC API: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;
      
      switch (response.status) {
        case 404:
          errorMessage = `Resource not found: ${endpoint}`;
          break;
        case 429:
          errorMessage = 'Rate limit exceeded';
          break;
        case 500:
          errorMessage = 'Internal server error';
          break;
      }
      
      throw new ICAPIError(errorMessage, response.status, endpoint);
    }
    
    const data = await response.json();
    const validatedData = validateResponse<T>(data, endpoint);

    console.log(`IC API response for ${endpoint}:`, validatedData);
    return validatedData;
  } catch (error) {
    if (error instanceof ICAPIError) {
      throw error;
    }
    console.error(`Error fetching from IC API (${endpoint}):`, error);
    throw new ICAPIError(
      `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      undefined,
      endpoint
    );
  }
}

// Fetch list of all subnets
export async function fetchSubnets(): Promise<Subnet[]> {
  const response = await fetchFromIC<SubnetsResponse>('/subnets');
  return response.subnets;
}

// Fetch details for a specific subnet
export async function fetchSubnetDetails(subnetId: string): Promise<SubnetDetail> {
  return fetchFromIC<SubnetDetail>(`/subnets/${subnetId}`);
}

// Fetch ICP to XDR conversion rates
export async function fetchICPtoXDRRates(): Promise<ConversionRateResponse> {
  return fetchFromIC<ConversionRateResponse>('/icp-xdr-conversion-rates');
}

// Fetch averaged ICP to XDR conversion rates
export async function fetchAverageICPtoXDRRates(): Promise<ConversionRateResponse> {
  return fetchFromIC<ConversionRateResponse>('/avg-icp-xdr-conversion-rates');
}

// Fetch current ICP price in USD
export async function fetchICPPrice(): Promise<ICPPriceResponse> {
  return fetchFromIC<ICPPriceResponse>('/icp-usd-rate');
}

// Fetch 24h ICP price change percentage
export async function fetchICPPriceChange(): Promise<ICPPriceChange> {
  return fetchFromIC<ICPPriceChange>('/icp-usd-percent-change-24h');
}

// Helper function to get the most recent ICP price
export function getMostRecentICPPrice(rates: [number, string][]): ICPPrice | null {
  if (!rates || rates.length === 0) return null;
  
  // Sort by timestamp in descending order
  const sorted = [...rates].sort((a, b) => b[0] - a[0]);
  const [timestamp, price] = sorted[0];
  
  return {
    timestamp,
    usdPrice: price
  };
}

// Helper function to get the most recent XDR rate
export function getMostRecentXDRRate(rates: [number, number][]): ConversionRate | null {
  if (!rates || rates.length === 0) return null;
  
  // Sort by timestamp in descending order
  const sorted = [...rates].sort((a, b) => b[0] - a[0]);
  const [timestamp, rate] = sorted[0];
  
  return {
    timestamp,
    xdrRate: rate
  };
}

// Fetch list of all subnets with detailed metrics
export async function fetchSubnetsWithMetrics(): Promise<Subnet[]> {
  try {
    // Fetch basic subnet data first
    const subnets = await fetchFromIC<{ subnets: Subnet[] }>('/subnets')
      .then(r => r.subnets)
      .catch(e => {
        console.error('Failed to fetch basic subnet data:', e);
        throw new ICAPIError('Failed to load subnet information');
      });

    if (!Array.isArray(subnets) || subnets.length === 0) {
      throw new ICAPIError('No subnets found');
    }

    // Initialize results with basic subnet data
    const results = subnets.map(subnet => ({
      ...subnet,
      metrics: {
        message_execution_rate: 0,
        block_rate: subnet.block_rate || 0,
        finalization_rate: 0,
        transaction_success_rate: 1,
        average_tps: 0,
        peak_tps: 0,
        cycles_burned_24h: 0
      },
      nodes: [] as NodeInfo[],
      data_centers: [] as DataCenter[],
      geographic_distribution: subnet.geographic_distribution || []
    }));

    // Try to fetch additional data in parallel
    const [nodes, dataCenters] = await Promise.allSettled([
      fetchFromIC<{ nodes: NodeInfo[] }>('/nodes').then(r => r.nodes),
      fetchFromIC<{ data_centers: DataCenter[] }>('/data-centers').then(r => r.data_centers),
    ]);

    // Add node data if available
    if (nodes.status === 'fulfilled' && Array.isArray(nodes.value)) {
      results.forEach(subnet => {
        subnet.nodes = nodes.value.filter(n => n.subnet_id === subnet.subnet_id);
      });
    } else {
      console.warn('Failed to fetch node data:', nodes.status === 'rejected' ? nodes.reason : 'Invalid data format');
    }

    // Add data center info if available
    if (dataCenters.status === 'fulfilled' && Array.isArray(dataCenters.value)) {
      results.forEach(subnet => {
        if (Array.isArray(subnet.geographic_distribution)) {
          subnet.data_centers = dataCenters.value.filter(dc => 
            subnet.geographic_distribution.includes(dc.region)
          );
        }
      });
    } else {
      console.warn('Failed to fetch data center info:', dataCenters.status === 'rejected' ? dataCenters.reason : 'Invalid data format');
    }

    return results;
  } catch (e) {
    console.error('Error in fetchSubnetsWithMetrics:', e);
    throw e;
  }
}

// Fetch detailed subnet information with analysis
export async function fetchSubnetDetailsWithAnalysis(subnetId: string): Promise<SubnetDetail> {
  const [detail, historicalMetrics, performance] = await Promise.all([
    fetchSubnetDetails(subnetId),
    fetchFromIC<SubnetHistoricalMetrics>(`/metrics/historical/${subnetId}`),
    fetchFromIC<SubnetDetail['performance_analysis']>(`/metrics/performance/${subnetId}`)
  ]);

  return {
    ...detail,
    historical_metrics: historicalMetrics,
    performance_analysis: performance,
    deployment_recommendations: await generateDeploymentRecommendations(detail, historicalMetrics, performance)
  };
}

// Helper function to analyze subnet performance and generate recommendations
async function generateDeploymentRecommendations(
  subnet: SubnetDetail,
  historical: SubnetHistoricalMetrics,
  performance: SubnetDetail['performance_analysis']
): Promise<SubnetDetail['deployment_recommendations']> {
  // Calculate average daily cycles cost
  const avgDailyCycles = historical.daily_cycles_burned.reduce((a, b) => a + b, 0) / 
    historical.daily_cycles_burned.length;

  // Get current ICP price for cost estimation
  const icpPrice = await fetchICPPrice().then(r => getMostRecentICPPrice(r.icp_usd_rate));
  const usdEquivalent = avgDailyCycles * (parseFloat(icpPrice?.usdPrice || '0') / 1e12);

  // Determine suitable use cases based on metrics
  const suitable: string[] = [];
  const cautions: string[] = [];

  if (performance) {
    // High performance applications
    if (performance.avg_tps_24h > 1000 && performance.latency_percentiles.p99 < 2000) {
      suitable.push('High-performance dapps');
    }

    // Data storage
    if (performance.resource_utilization.storage_percentage < 70) {
      suitable.push('Data storage applications');
    } else {
      cautions.push('Storage capacity is limited');
    }

    // DeFi applications
    if (performance.uptime_percentage_30d > 99.9 && performance.latency_percentiles.p99 < 1000) {
      suitable.push('DeFi protocols');
    }

    // Add cautions based on metrics
    if (performance.resource_utilization.cpu_percentage > 80) {
      cautions.push('High CPU utilization');
    }
    if (performance.resource_utilization.memory_percentage > 80) {
      cautions.push('High memory usage');
    }
    if (performance.uptime_percentage_30d < 99.5) {
      cautions.push('Lower uptime than recommended');
    }
  }

  // Social applications - use metrics if available
  if (subnet.metrics && subnet.metrics.message_execution_rate > 100) {
    suitable.push('Social dapps');
  }

  return {
    suitable_for: suitable,
    cautions,
    estimated_costs: {
      cycles_per_day: avgDailyCycles,
      usd_equivalent: usdEquivalent
    }
  };
}

// Calculate subnet reliability score (0-100)
export function calculateReliabilityScore(subnet: SubnetDetail): number {
  if (!subnet.performance_analysis) return 0;

  const {
    uptime_percentage_30d,
    latency_percentiles,
    resource_utilization
  } = subnet.performance_analysis;

  // Weighted scoring factors
  const uptimeScore = uptime_percentage_30d;
  const latencyScore = Math.max(0, 100 - (latencyPercentilesScore(latency_percentiles) / 10));
  const resourceScore = 100 - (resourceUtilizationScore(resource_utilization));

  // Weighted average (uptime: 40%, latency: 30%, resources: 30%)
  return Math.round(
    (uptimeScore * 0.4) +
    (latencyScore * 0.3) +
    (resourceScore * 0.3)
  );
}

// Helper function to score latency percentiles
function latencyPercentilesScore(percentiles: NonNullable<SubnetDetail['performance_analysis']>['latency_percentiles']): number {
  return (
    (percentiles.p50 * 0.3) +
    (percentiles.p95 * 0.3) +
    (percentiles.p99 * 0.4)
  );
}

// Helper function to score resource utilization
function resourceUtilizationScore(utilization: NonNullable<SubnetDetail['performance_analysis']>['resource_utilization']): number {
  return (
    (utilization.cpu_percentage * 0.4) +
    (utilization.memory_percentage * 0.4) +
    (utilization.storage_percentage * 0.2)
  );
}

// Find the best subnet for a given use case
export async function findBestSubnetForUseCase(useCase: string): Promise<Subnet | null> {
  const subnets = await fetchSubnetsWithMetrics();
  const analyzedSubnets = await Promise.all(
    subnets.map(async subnet => {
      const details = await fetchSubnetDetailsWithAnalysis(subnet.subnet_id);
      return {
        ...details,
        reliability_score: calculateReliabilityScore(details)
      };
    })
  );

  // Filter subnets suitable for the use case
  const suitableSubnets = analyzedSubnets.filter(subnet =>
    subnet.deployment_recommendations?.suitable_for.includes(useCase)
  );

  if (suitableSubnets.length === 0) return null;

  // Sort by reliability score and return the best match
  return suitableSubnets.sort((a, b) => 
    (b.reliability_score || 0) - (a.reliability_score || 0)
  )[0];
}

// Analyze geographic distribution of a subnet
export function analyzeGeographicDistribution(subnet: SubnetDetail): {
  regions: string[];
  primaryRegion: string;
  redundancy: number;
  decentralizationScore: number;
} {
  if (!subnet.data_centers || subnet.data_centers.length === 0) {
    return {
      regions: [],
      primaryRegion: 'Unknown',
      redundancy: 0,
      decentralizationScore: 0
    };
  }

  // Count nodes per region
  const regionCounts = subnet.data_centers.reduce((acc, dc) => {
    acc[dc.region] = (acc[dc.region] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const regions = Object.keys(regionCounts);
  const primaryRegion = regions.reduce((a, b) => 
    regionCounts[a] > regionCounts[b] ? a : b
  );

  // Calculate redundancy (minimum nodes per region)
  const redundancy = Math.min(...Object.values(regionCounts));

  // Calculate decentralization score (0-100)
  // Higher score means more even distribution across regions
  const totalNodes = Object.values(regionCounts).reduce((a, b) => a + b, 0);
  const idealNodesPerRegion = totalNodes / regions.length;
  const variance = Object.values(regionCounts).reduce(
    (acc, count) => acc + Math.pow(count - idealNodesPerRegion, 2),
    0
  ) / regions.length;
  const decentralizationScore = Math.round(
    100 * (1 - Math.sqrt(variance) / totalNodes)
  );

  return {
    regions,
    primaryRegion,
    redundancy,
    decentralizationScore
  };
}

// Analyze node health for a subnet
export function analyzeNodeHealth(subnet: SubnetDetail): {
  totalNodes: number;
  activeNodes: number;
  healthyPercentage: number;
  averageUptime: number;
  performanceIssues: string[];
} {
  if (!subnet.nodes) {
    return {
      totalNodes: 0,
      activeNodes: 0,
      healthyPercentage: 0,
      averageUptime: 0,
      performanceIssues: ['No node data available']
    };
  }

  const totalNodes = subnet.nodes.length;
  const activeNodes = subnet.nodes.filter(n => n.status === 'active').length;
  const nodesWithMetrics = subnet.nodes.filter(n => n.metrics);

  const averageUptime = nodesWithMetrics.length > 0
    ? nodesWithMetrics.reduce((acc, node) => acc + (node.metrics?.uptime || 0), 0) / nodesWithMetrics.length
    : 0;

  const performanceIssues: string[] = [];
  
  // Analyze CPU usage
  const highCpuNodes = nodesWithMetrics.filter(n => (n.metrics?.cpu_usage || 0) > 80).length;
  if (highCpuNodes > 0) {
    performanceIssues.push(`${highCpuNodes} nodes with high CPU usage`);
  }

  // Analyze memory usage
  const highMemoryNodes = nodesWithMetrics.filter(n => (n.metrics?.memory_usage || 0) > 80).length;
  if (highMemoryNodes > 0) {
    performanceIssues.push(`${highMemoryNodes} nodes with high memory usage`);
  }

  // Check for nodes with low bandwidth
  const lowBandwidthNodes = nodesWithMetrics.filter(n => (n.metrics?.network_bandwidth || 0) < 100).length;
  if (lowBandwidthNodes > 0) {
    performanceIssues.push(`${lowBandwidthNodes} nodes with low network bandwidth`);
  }

  return {
    totalNodes,
    activeNodes,
    healthyPercentage: (activeNodes / totalNodes) * 100,
    averageUptime,
    performanceIssues
  };
}

// Get comprehensive subnet analysis
export async function getSubnetAnalysis(subnetId: string): Promise<{
  details: SubnetDetail;
  reliability: number;
  geographic: ReturnType<typeof analyzeGeographicDistribution>;
  nodeHealth: ReturnType<typeof analyzeNodeHealth>;
  recommendations: string[];
}> {
  const details = await fetchSubnetDetailsWithAnalysis(subnetId);
  const reliability = calculateReliabilityScore(details);
  const geographic = analyzeGeographicDistribution(details);
  const nodeHealth = analyzeNodeHealth(details);

  // Generate overall recommendations
  const recommendations: string[] = [];

  // Performance recommendations
  if (reliability < 80) {
    recommendations.push('Consider using a subnet with higher reliability for critical applications');
  }

  // Geographic recommendations
  if (geographic.decentralizationScore < 70) {
    recommendations.push('This subnet has limited geographic distribution, which may impact latency for global users');
  }
  if (geographic.redundancy < 3) {
    recommendations.push('Low regional redundancy may affect fault tolerance');
  }

  // Node health recommendations
  if (nodeHealth.healthyPercentage < 90) {
    recommendations.push('Subnet has a significant number of unhealthy nodes');
  }
  if (nodeHealth.performanceIssues.length > 0) {
    recommendations.push('Some nodes are experiencing performance issues');
  }

  return {
    details,
    reliability,
    geographic,
    nodeHealth,
    recommendations
  };
}

// Get a human-readable summary of subnet characteristics
export function getSubnetSummary(analysis: Awaited<ReturnType<typeof getSubnetAnalysis>>): string {
  const {details, reliability, geographic, nodeHealth} = analysis;
  
  return `
Subnet ${details.subnet_id} Summary:
- Type: ${details.subnet_type}
- Reliability Score: ${reliability}/100
- Geographic Distribution: ${geographic.regions.length} regions (primary: ${geographic.primaryRegion})
- Nodes: ${nodeHealth.activeNodes}/${nodeHealth.totalNodes} active (${nodeHealth.healthyPercentage.toFixed(1)}% healthy)
- Average Uptime: ${nodeHealth.averageUptime.toFixed(1)}%
- Performance:
  * TPS (avg/peak): ${details.performance_analysis?.avg_tps_24h.toFixed(1)}/${details.metrics?.peak_tps}
  * Block Rate: ${details.metrics?.block_rate.toFixed(2)} blocks/sec
  * Memory Usage: ${details.performance_analysis?.resource_utilization.memory_percentage.toFixed(1)}%
- Estimated Daily Cost: ${details.deployment_recommendations?.estimated_costs.usd_equivalent.toFixed(2)} USD
- Best suited for: ${details.deployment_recommendations?.suitable_for.join(', ')}
${details.deployment_recommendations?.cautions.length ? '- Cautions: ' + details.deployment_recommendations.cautions.join(', ') : ''}
`.trim();
}

// Fetch subnet types from the Cycles Minting Canister
export async function fetchSubnetTypesFromCMC(): Promise<Map<string, Principal[]>> {
  try {
    // CMC canister ID
    const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai";
    
    // Create an actor for the CMC
    const cmcActor = await auth.getActor(
      CMC_CANISTER_ID,
      cmcIdlFactory,
      { requiresSigning: false } // Read-only query
    );
    
    // Call the get_subnet_types_to_subnets method
    const response = await cmcActor.get_subnet_types_to_subnets();
    console.log("Raw CMC subnet types response:", response);
    
    // Convert the response to a Map for easier access
    const subnetTypesMap = new Map<string, Principal[]>();
    
    if (response && response.data && Array.isArray(response.data)) {
      response.data.forEach(([type, subnets]) => {
        console.log(`Processing subnet type: ${type} with ${subnets.length} subnets`);
        subnetTypesMap.set(type, subnets);
      });
    }
    
    return subnetTypesMap;
  } catch (error) {
    console.error('Error fetching subnet types from CMC:', error);
    throw new ICAPIError('Failed to fetch subnet types from CMC');
  }
}

// Fetch default subnets from the Cycles Minting Canister
export async function fetchDefaultSubnets(): Promise<Principal[]> {
  try {
    // CMC canister ID
    const CMC_CANISTER_ID = "rkp4c-7iaaa-aaaaa-aaaca-cai";
    
    // Create an actor for the CMC
    const cmcActor = await auth.getActor(
      CMC_CANISTER_ID,
      cmcIdlFactory,
      { requiresSigning: false } // Read-only query
    );
    
    // Call the get_default_subnets method
    const subnets = await cmcActor.get_default_subnets();
    console.log("Default subnets from CMC:", subnets.map(s => s.toText()));
    
    return subnets;
  } catch (error) {
    console.error('Error fetching default subnets from CMC:', error);
    throw new ICAPIError('Failed to fetch default subnets from CMC');
  }
}
