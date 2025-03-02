// Kong Agent NLP System - ICP Optimized
// This module provides lightweight natural language processing capabilities for the Kong Agent

/**
 * Types of intents that can be detected
 */
export type IntentType = 
  | 'whoami' 
  | 'start_token' 
  | 'register_miner'
  | 'deregister_miner'
  | 'get_info'
  | 'get_mining_info'
  | 'get_miner_stats'
  | 'start_mining'
  | 'stop_mining'
  | 'get_status'
  | 'help'
  | 'memory'
  | 'unknown';

/**
 * Intent detection result
 */
export interface IntentResult {
  intent: IntentType;
  confidence: number;
  entities: Record<string, any>;
  originalText: string;
}

/**
 * Word-intent vocabulary with confidence weights
 */
interface VocabularyItem {
  [intent: string]: number;
}

/**
 * Response template configuration
 */
interface ResponseTemplateConfig {
  templates: string[];
  formatResponse: (template: string, result: any, entities: Record<string, any>) => string;
}

/**
 * Natural language processor for Kong Agent - ICP Optimized
 */
export class KongAgentNLP {
  private vocabulary: Record<string, VocabularyItem>;
  private phraseMappings: Array<{pattern: RegExp, intent: IntentType, weight: number}>;
  private responses: Record<IntentType, ResponseTemplateConfig>;
  private canisterType: string | null;
  private fallbackResponses: string[];
  private memoryPhrases: RegExp[];
  private recallPhrases: RegExp[];
  
  constructor(canisterType: string | null = null) {
    this.canisterType = canisterType;
    this.fallbackResponses = [
      "I'm not sure what you're asking for. Try typing 'help' to see available commands.",
      "I didn't understand that request. You can type 'help' to see what I can do.",
      "Sorry, I don't know how to process that. Type 'help' for available commands."
    ];
    
    // Define vocabulary with intent weights
    this.vocabulary = {
      // Identity-related
      "who": { whoami: 0.95 },
      "id": { whoami: 0.8 },
      "identity": { whoami: 0.9 },
      "principal": { whoami: 0.9 },
      "me": { whoami: 0.4 },
      "my": { whoami: 0.5 },
      "am": { whoami: 0.7 },
      
      // Token-related
      "token": { start_token: 0.3, get_info: 0.7 },
      "start": { start_token: 0.8, start_mining: 0.7 },
      "initialize": { start_token: 0.9 },
      "create": { start_token: 0.7 },
      "setup": { start_token: 0.8 },
      "launch": { start_token: 0.8 },
      
      // Mining-related
      "miner": { register_miner: 0.6, deregister_miner: 0.4, get_miner_stats: 0.7 },
      "mining": { get_mining_info: 0.7, start_mining: 0.6, stop_mining: 0.6 },
      "mine": { register_miner: 0.7, start_mining: 0.8 },
      "register": { register_miner: 0.9 },
      "deregister": { deregister_miner: 0.9 },
      "unregister": { deregister_miner: 0.9 },
      "stats": { get_miner_stats: 0.9 },
      
      // Action verbs
      "become": { register_miner: 0.8 },
      "stop": { stop_mining: 0.8, deregister_miner: 0.6 },
      "quit": { deregister_miner: 0.8, stop_mining: 0.7 },
      "cancel": { deregister_miner: 0.7 },
      "remove": { deregister_miner: 0.7 },
      
      // Intent markers
      "want": { register_miner: 0.5, start_mining: 0.5 },
      "wanna": { register_miner: 0.5, start_mining: 0.5 },
      "like": { register_miner: 0.4 },
      "show": { get_info: 0.6, get_mining_info: 0.6, get_miner_stats: 0.6, whoami: 0.5 },
      "tell": { get_info: 0.6, get_mining_info: 0.6, get_miner_stats: 0.6, whoami: 0.5 },
      "get": { get_info: 0.7, get_mining_info: 0.7, get_miner_stats: 0.7 },
      "info": { get_info: 0.8, get_mining_info: 0.5 },
      "information": { get_info: 0.7, get_mining_info: 0.5 },
      "details": { get_info: 0.7, get_mining_info: 0.5 },
      "status": { get_status: 0.9 },
      
      // Help-related
      "help": { help: 0.95 },
      "commands": { help: 0.9 },
      "capabilities": { help: 0.8 },
      "features": { help: 0.8 },
      "how": { help: 0.4 },
      "what": { help: 0.3 },
      
      // Memory-related
      "remember": { memory: 0.95 },
      "store": { memory: 0.9 },
      "save": { memory: 0.85 },
      "recall": { memory: 0.8 },
      "forgot": { memory: 0.7 }
    };
    
    // Define phrase patterns with higher precedence than individual words
    this.phraseMappings = [
      // Identity phrases
      {pattern: /who am i/i, intent: 'whoami', weight: 1.0},
      {pattern: /what('s| is) my (id|identity|principal)/i, intent: 'whoami', weight: 1.0},
      {pattern: /show me my (id|identity|principal)/i, intent: 'whoami', weight: 1.0},
      
      // Token phrases
      {pattern: /(start|initialize|create|setup) (a |the )?token/i, intent: 'start_token', weight: 1.0},
      {pattern: /(get|show|tell me)( about)?( the)? token (info|information|details)/i, intent: 'get_info', weight: 1.0},
      
      // Mining phrases
      {pattern: /i (want|wanna|would like) to (be|become) a miner/i, intent: 'register_miner', weight: 1.0},
      {pattern: /(make|set) me (a|as) (a )?miner/i, intent: 'register_miner', weight: 1.0},
      {pattern: /i (want|wanna|would like) to (start )?min(e|ing)/i, intent: 'register_miner', weight: 1.0},
      {pattern: /(signup|sign up|sign me up)( as| for)? min(er|ing)/i, intent: 'register_miner', weight: 1.0},
      
      {pattern: /i (don't|do not) (want|wanna) to (be|become) a miner/i, intent: 'deregister_miner', weight: 1.0},
      {pattern: /(stop|quit|remove me) (as|from) (being )?(a )?miner/i, intent: 'deregister_miner', weight: 1.0},
      
      {pattern: /(get|show|tell me)( about)?( the)? min(er|ing) (info|information|details)/i, intent: 'get_mining_info', weight: 1.0},
      {pattern: /(get|show|tell me)( about)?( my)? min(er|ing) stats/i, intent: 'get_miner_stats', weight: 1.0},
      
      // Direct commands with high confidence
      {pattern: /^start_token$/i, intent: 'start_token', weight: 1.0},
      {pattern: /^register_miner$/i, intent: 'register_miner', weight: 1.0},
      {pattern: /^deregister_miner$/i, intent: 'deregister_miner', weight: 1.0},
      {pattern: /^get_info$/i, intent: 'get_info', weight: 1.0},
      {pattern: /^get_mining_info$/i, intent: 'get_mining_info', weight: 1.0},
      {pattern: /^get_miner_stats$/i, intent: 'get_miner_stats', weight: 1.0},
      {pattern: /^whoami$/i, intent: 'whoami', weight: 1.0},
      {pattern: /^help$/i, intent: 'help', weight: 1.0}
    ];
    
    // Memory-related patterns
    this.memoryPhrases = [
      /remember (that |this )?(?<memory>.+)/i,
      /store (that |this )?(?<memory>.+)/i,
      /save (that |this )?(?<memory>.+)/i,
      /memorize (that |this )?(?<memory>.+)/i,
      /keep in mind (that |this )?(?<memory>.+)/i
    ];
    
    this.recallPhrases = [
      /what (did|have) (you|i) (remember|recall|memorize|store)/i,
      /what (did|have) i (ask|tell) you to (remember|recall|memorize|store)/i,
      /recall what i (said|told you)/i
    ];
    
    // Define response templates
    this.responses = {
      'whoami': {
        templates: [
          "You are {principal}",
          "Your principal ID is {principal}",
          "Here's your identity: {principal}",
          "Your principal identifier is {principal}"
        ],
        formatResponse: (template, result, entities) => {
          return template.replace(/{principal}/g, result.toText());
        }
      },
      'start_token': {
        templates: [
          "Token started successfully! I've created a ledger canister with ID: {ledgerId}",
          "Great! Your token is now initialized with ledger {ledgerId}",
          "Token initialization complete. Your ledger canister ID is {ledgerId}",
          "Successfully started the token. Ledger canister created: {ledgerId}"
        ],
        formatResponse: (template, result, entities) => {
          const ledgerId = result.Ok.toText();
          return template.replace(/{ledgerId}/g, ledgerId);
        }
      },
      'register_miner': {
        templates: [
          "You're now registered as a miner!",
          "Registration successful! You can now mine tokens.",
          "You've been added to the miners list. Happy mining!",
          "Mining registration complete. You can start mining now."
        ],
        formatResponse: (template, result, entities) => {
          return template;
        }
      },
      'deregister_miner': {
        templates: [
          "You've been deregistered as a miner.",
          "Mining registration cancelled successfully.",
          "You're no longer registered as a miner.",
          "Successfully removed from the miners list."
        ],
        formatResponse: (template, result, entities) => {
          return template;
        }
      },
      'get_info': {
        templates: [
          "Here's the token information:\n{info}",
          "Token details:\n{info}",
          "I found this information about the token:\n{info}",
          "Here's what I know about this token:\n{info}"
        ],
        formatResponse: (template, result, entities) => {
          const info = result.Ok;
          const formattedInfo = `
Token Name: ${info.name}
Ticker: ${info.ticker}
Decimals: ${info.decimals}
Total Supply: ${info.total_supply.toString()}
Transfer Fee: ${info.transfer_fee.toString()}
Ledger ID: ${info.ledger_id && info.ledger_id.length > 0 && info.ledger_id[0]?.toText ? info.ledger_id[0].toText() : 'Not created yet'}
`.trim();
          
          return template.replace(/{info}/g, '```\n' + formattedInfo + '\n```');
        }
      },
      'get_mining_info': {
        templates: [
          "Here's the current mining information:\n{info}",
          "Mining status details:\n{info}",
          "Current mining parameters:\n{info}",
          "Here's the mining configuration:\n{info}"
        ],
        formatResponse: (template, result, entities) => {
          const formattedInfo = `
Current Difficulty: ${result.current_difficulty}
Block Time Target: ${result.block_time_target} seconds
Current Block Reward: ${result.current_block_reward.toString()}
Next Halving Interval: ${result.next_halving_interval.toString()}
Mining Complete: ${result.mining_complete ? 'Yes' : 'No'}
`.trim();
          
          return template.replace(/{info}/g, '```\n' + formattedInfo + '\n```');
        }
      },
      'get_miner_stats': {
        templates: [
          "Miner statistics:\n{stats}",
          "Here are your mining stats:\n{stats}",
          "Mining performance details:\n{stats}",
          "Stats for miner {principal}:\n{stats}"
        ],
        formatResponse: (template, result, entities) => {
          let formattedStats = '';
          if (result.Ok) {
            formattedStats = `
Principal: ${result.Ok.principal.toText()}
Blocks Mined: ${result.Ok.blocks_mined}
Tokens Mined: ${result.Ok.tokens_mined.toString()}
Last Mining Timestamp: ${new Date(Number(result.Ok.last_mine_timeshift)).toLocaleString()}
`.trim();
          } else {
            formattedStats = 'No statistics available for this miner.';
          }
          
          const principal = entities.principal || 'you';
          return template
            .replace(/{stats}/g, '```\n' + formattedStats + '\n```')
            .replace(/{principal}/g, principal);
        }
      },
      'memory': {
        templates: [
          "I'll remember that: \"{content}\"",
          "Got it, I've stored: \"{content}\"",
          "I've made a note of: \"{content}\"",
          "I'll keep that in mind: \"{content}\""
        ],
        formatResponse: (template, result, entities) => {
          return template.replace(/{content}/g, entities.memory || '');
        }
      },
      'help': {
        templates: [
          "Here are the available commands:\n{commands}",
          "You can use the following commands:\n{commands}",
          "Available commands for this canister:\n{commands}",
          "Here's what I can do:\n{commands}"
        ],
        formatResponse: (template, result, entities) => {
          return template.replace(/{commands}/g, result);
        }
      },
      'unknown': {
        templates: this.fallbackResponses,
        formatResponse: (template, result, entities) => {
          return template;
        }
      }
    };
    
    // Add default templates for other intents
    ['start_mining', 'stop_mining', 'get_status'].forEach(intent => {
      if (!this.responses[intent as IntentType]) {
        this.responses[intent as IntentType] = {
          templates: [
            "Command executed successfully: " + intent,
            "Operation complete: " + intent,
            "Finished running: " + intent
          ],
          formatResponse: (template, result, entities) => {
            return template;
          }
        };
      }
    });
  }
  
  /**
   * Detect intent from user input
   */
  detectIntent(text: string): IntentResult {
    const cleanText = text.trim();
    
    // Check if this is a memory store request
    for (const pattern of this.memoryPhrases) {
      const match = cleanText.match(pattern);
      if (match && match.groups?.memory) {
        return {
          intent: 'memory',
          confidence: 0.95,
          entities: { memory: match.groups.memory.trim() },
          originalText: cleanText
        };
      }
    }
    
    // Check if this is a memory recall request
    for (const pattern of this.recallPhrases) {
      if (pattern.test(cleanText)) {
        return {
          intent: 'memory',
          confidence: 0.95,
          entities: { recall: true },
          originalText: cleanText
        };
      }
    }
    
    // First check for exact phrase matches with higher priority
    for (const mapping of this.phraseMappings) {
      if (mapping.pattern.test(cleanText)) {
        // Check canister type compatibility
        if (this.isIntentCompatibleWithCanister(mapping.intent)) {
          return {
            intent: mapping.intent,
            confidence: mapping.weight,
            entities: this.extractEntities(mapping.intent, cleanText),
            originalText: cleanText
          };
        }
      }
    }
    
    // If no phrase match, use vocabulary-based scoring
    const words = cleanText.toLowerCase().split(/\s+/);
    const scores: Record<string, number> = {};
    
    // Calculate scores for each intent based on word presence
    for (const word of words) {
      if (this.vocabulary[word]) {
        for (const [intent, weight] of Object.entries(this.vocabulary[word])) {
          scores[intent] = (scores[intent] || 0) + weight;
        }
      }
    }
    
    // Find intent with highest score, excluding incompatible intents
    let bestIntent: IntentType = 'unknown';
    let highestScore = 0;
    
    for (const [intent, score] of Object.entries(scores)) {
      if (score > highestScore && this.isIntentCompatibleWithCanister(intent as IntentType)) {
        highestScore = score;
        bestIntent = intent as IntentType;
      }
    }
    
    // Calculate confidence as normalized score
    const confidence = words.length > 0 ? Math.min(highestScore / (words.length * 0.8), 0.95) : 0;
    
    // Only return non-unknown intents if confidence is reasonable
    if (bestIntent !== 'unknown' && confidence < 0.4) {
      bestIntent = 'unknown';
    }
    
    return {
      intent: bestIntent,
      confidence,
      entities: this.extractEntities(bestIntent, cleanText),
      originalText: cleanText
    };
  }
  
  /**
   * Check if an intent is compatible with the current canister type
   */
  private isIntentCompatibleWithCanister(intent: IntentType): boolean {
    // Some intents are specific to canister types
    const tokenBackendIntents = [
      'start_token', 'register_miner', 'deregister_miner', 
      'get_info', 'get_mining_info', 'get_miner_stats'
    ];
    
    const minerIntents = [
      'start_mining', 'stop_mining', 'get_status'
    ];
    
    // Universal intents that work with any canister
    const universalIntents = [
      'whoami', 'help', 'memory', 'unknown'
    ];
    
    if (universalIntents.includes(intent)) {
      return true;
    }
    
    if (!this.canisterType) {
      return false;
    }
    
    if (this.canisterType === 'token_backend' && tokenBackendIntents.includes(intent)) {
      return true;
    }
    
    if (this.canisterType === 'miner' && minerIntents.includes(intent)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Extract entities from text based on the intent
   */
  private extractEntities(intent: IntentType, text: string): Record<string, any> {
    const entities: Record<string, any> = {};
    
    // Extract principal for get_miner_stats
    if (intent === 'get_miner_stats') {
      const principalMatch = text.match(/stats for ([a-zA-Z0-9-]+)/i);
      if (principalMatch) {
        entities.principal = principalMatch[1];
      }
    }
    
    return entities;
  }
  
  /**
   * Format a response based on the intent and result
   */
  formatResponse(intent: IntentType, result: any, entities: Record<string, any> = {}): string {
    const config = this.responses[intent];
    if (!config) {
      return this.getRandomTemplate(this.fallbackResponses);
    }
    
    const template = this.getRandomTemplate(config.templates);
    return config.formatResponse(template, result, entities);
  }
  
  /**
   * Get a random template from an array of templates
   */
  private getRandomTemplate(templates: string[]): string {
    const index = Math.floor(Math.random() * templates.length);
    return templates[index];
  }

  /**
   * Update the canister type
   */
  updateCanisterType(canisterType: string | null): void {
    this.canisterType = canisterType;
  }
  
  /**
   * Get examples of what users can ask
   */
  getExamples(): string[] {
    return [
      "Who am I?",
      "I want to become a miner",
      "Tell me about the token",
      "Show mining information",
      "What are my mining stats?",
      "Start the token",
      "I don't want to be a miner anymore",
      "Remember that my favorite color is blue",
      "What did you remember about me?"
    ];
  }
} 
