<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { idlFactory as tokenBackendIdlFactory } from '../../../../../declarations/token_backend/token_backend.did.js';
  import { auth } from '$lib/services/auth';
  import { fade } from 'svelte/transition';
  import { KongAgentNLP, type IntentResult } from './KongAgentNLP';
  import { Interpreter } from './KongAgentNLP.Interpreter';

  // Props
  export let canisterId: string;
  export let wasmType: string | null = null;

  // Initialize NLP system
  let nlpSystem: KongAgentNLP;
  let interpreter: Interpreter;

  // Event dispatcher
  const dispatch = createEventDispatcher();

  // Chat state
  type MessageType = 'system' | 'user' | 'agent' | 'error';
  
  interface ChatMessage {
    id: string;
    type: MessageType;
    content: string;
    timestamp: number;
    isLoading?: boolean;
    command?: string;
    result?: any;
  }

  let messages: ChatMessage[] = [];
  let inputMessage = '';
  let isProcessing = false;
  let actor: any = null;
  let actorError: string | null = null;

  // Mouse position tracking for parallax effects
  let mouseX = 0;
  let mouseY = 0;
  let ticking = false;

  function handleMouseMove(e: MouseEvent) {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 10;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 10;
        ticking = false;
      });
      ticking = true;
    }
  }

  // Generate random positions for nebula gradients
  const nebulaPositions = {
    blue: {
      x: 20 + Math.random() * 40, // 20-60%
      y: 10 + Math.random() * 30  // 10-40%
    },
    purple1: {
      x: 50 + Math.random() * 40, // 50-90%
      y: 40 + Math.random() * 40  // 40-80%
    },
    purple2: {
      x: 20 + Math.random() * 40, // 20-60%
      y: 50 + Math.random() * 40  // 50-90%
    },
    purple3: {
      x: 60 + Math.random() * 30, // 60-90%
      y: 10 + Math.random() * 40  // 10-50%
    }
  };

  // Enhanced 3D star field with depth layers
  const starCount = 80;
  const starLayers = 3;
  const stars = Array(starCount).fill(0).map(() => ({
    size: 0.6 + Math.random() * 2.2,
    top: Math.random() * 100,
    left: Math.random() * 100,
    brightness: 0.4 + Math.random() * 0.6,
    depth: Math.floor(Math.random() * starLayers),
    twinkle: Math.random() > 0.7
  }));

  // Available commands based on canister type
  const availableCommands: Record<string, Record<string, { description: string, example: string }>> = {
    'token_backend': {
      'start_token': {
        description: 'Initialize the token and create a ledger canister',
        example: 'start_token'
      },
      'register_miner': {
        description: 'Register as a miner for this token',
        example: 'register_miner'
      },
      'deregister_miner': {
        description: 'Deregister as a miner',
        example: 'deregister_miner'
      },
      'get_info': {
        description: 'Get token information',
        example: 'get_info'
      },
      'get_mining_info': {
        description: 'Get mining information',
        example: 'get_mining_info'
      },
      'get_miner_stats': {
        description: 'Get miner statistics',
        example: 'get_miner_stats <principal>'
      },
      'whoami': {
        description: 'Get your principal ID',
        example: 'whoami'
      }
    },
    'miner': {
      'start_mining': {
        description: 'Start mining',
        example: 'start_mining'
      },
      'stop_mining': {
        description: 'Stop mining',
        example: 'stop_mining'
      },
      'get_status': {
        description: 'Get miner status',
        example: 'get_status'
      }
    }
  };

  // Helper function to generate a unique ID
  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  // Add a message to the chat
  function addMessage(type: MessageType, content: string, options: Partial<ChatMessage> = {}): string {
    const id = generateId();
    messages = [
      ...messages,
      {
        id,
        type,
        content,
        timestamp: Date.now(),
        ...options
      }
    ];
    
    // Only scroll for new non-loading messages (for immediate visibility)
    // Loading messages will be scrolled when they finish loading
    if (!options.isLoading) {
      scrollToBottom();
    }
    
    return id;
  }

  // Update a message by ID
  function updateMessage(id: string, updates: Partial<ChatMessage>) {
    messages = messages.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    );
    
    // If this is a message update that's finishing loading (like a response),
    // then scroll to the bottom
    if (updates.isLoading === false) {
      scrollToBottom();
    }
  }

  // Initialize the chat with welcome messages
  function initializeChat() {
    // Initialize NLP system with the canister type
    nlpSystem = new KongAgentNLP(wasmType);
    
    // Initialize the interpreter
    interpreter = new Interpreter();
    
    // Register custom functions for the interpreter
    interpreter.registerFunction('getCanisterID', () => canisterId);
    interpreter.registerFunction('getCanisterType', () => wasmType);
    interpreter.registerFunction('formatResult', (result: any) => {
      return JSON.stringify(result, null, 2);
    });
    
    // Clear any existing messages
    messages = [];
    
    // Add welcome message
    addMessage('system', 'Welcome to Kong Agent! 🤖');
    addMessage('system', `Connected to canister: ${canisterId}`);
    
    if (wasmType) {
      addMessage('system', `Canister type: ${wasmType}`);
      
      // Add available commands based on canister type
      if (wasmType && availableCommands[wasmType]) {
        const commandList = Object.entries(availableCommands[wasmType])
          .map(([cmd, info]) => `• \`${info.example}\` - ${info.description}`)
          .join('\n');
        
        addMessage('system', `Available commands:\n${commandList}`);
      }
    } else {
      addMessage('system', 'Canister type unknown. Limited functionality available.');
    }
    
    addMessage('agent', 'How can I help you with your canister today? You can use natural language or direct commands.');
  }

  // Create actor for the canister
  async function createActor() {
    try {
      // Get the appropriate IDL factory based on canister type
      let idlFactory;
      
      if (wasmType === 'token_backend') {
        idlFactory = tokenBackendIdlFactory;
      } else {
        // Default to token_backend for now
        idlFactory = tokenBackendIdlFactory;
      }
      
      // make actor
      actor = auth.getActor(canisterId, idlFactory);
      
      // Verify actor methods to debug
      console.log('Created actor with methods:', actor);
      
      actorError = null;
      return true;
    } catch (error) {
      console.error('Error creating actor:', error);
      actorError = error instanceof Error ? error.message : String(error);
      addMessage('error', `Failed to connect to canister: ${actorError}`);
      return false;
    }
  }

  // Handle user input
  async function handleSubmit() {
    if (!inputMessage.trim() || isProcessing) return;
    
    const userMessage = inputMessage.trim();
    addMessage('user', userMessage);
    
    // Clear input
    inputMessage = '';
    isProcessing = true;
    
    // Force scroll to bottom after user sends a message
    scrollToBottom();
    
    // Process the message
    await processMessage(userMessage);
    
    isProcessing = false;
  }

  // Function to scroll to the bottom of the chat
  function scrollToBottom() {
    if (chatContainer) {
      setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }, 0);
    }
  }

  // Process user messages with NLP
  async function processMessage(message: string) {
    // Check if actor is available
    if (!actor && !actorError) {
      const loadingId = addMessage('agent', 'Connecting to canister...', { isLoading: true });
      const success = await createActor();
      
      if (!success) {
        updateMessage(loadingId, { 
          content: 'Failed to connect to the canister. Please try again later.',
          isLoading: false,
          type: 'error'
        });
        return;
      }
      
      updateMessage(loadingId, { 
        content: 'Connected to canister successfully!',
        isLoading: false
      });
    }
    
    if (!actor) {
      addMessage('error', 'Cannot process your request: No connection to canister.');
      return;
    }
    
    // Use NLP to determine intent
    const intent = nlpSystem.detectIntent(message);
    
    // Process the intent with the interpreter
    // Reset the interpreter state
    interpreter.reset();
    interpreter.setVariable('canisterId', canisterId);
    interpreter.setVariable('wasmType', wasmType);
    
    // Set up variables for advanced processing
    const scriptVars = {
      message,
      timestamp: Date.now(),
      userPrincipal: null // Will be populated once whoami is called
    };
    
    // Create a basic script for processing the intent
    const script = {
      intent: intent.intent,
      variables: scriptVars,
      actions: [] // By default, no actions - regular processing will be used
    };
    
    // Set this as the current script in the interpreter
    interpreter.processIntent(intent, script);
    
    // Process the intent
    const loadingId = addMessage('agent', 'Processing your request...', { isLoading: true });
    
    try {
      await executeIntent(loadingId, intent);
    } catch (error) {
      console.error('Error processing message:', error);
      updateMessage(loadingId, {
        content: `Error processing your request: ${error instanceof Error ? error.message : String(error)}`,
        isLoading: false,
        type: 'error'
      });
    }
  }
  
  // Process user commands (legacy method, now replaced by processMessage)
  async function processCommand(command: string) {
    // For backward compatibility, directly call processMessage
    await processMessage(command);
  }

  // Execute the detected intent
  async function executeIntent(loadingId: string, intent: IntentResult) {
    console.log('Executing intent:', intent);
    
    try {
      // Execute the appropriate command based on intent
      let result;
      
      switch (intent.intent) {
        case 'help':
          // Show available commands
          if (wasmType && availableCommands[wasmType]) {
            const commandList = Object.entries(availableCommands[wasmType])
              .map(([cmd, info]) => `• \`${info.example}\` - ${info.description}`)
              .join('\n');
            
            // Store help text in interpreter memory for potential use
            interpreter.setVariable('helpText', commandList);
            
            updateMessage(loadingId, {
              content: nlpSystem.formatResponse('help', commandList, intent.entities),
              isLoading: false
            });
          } else {
            updateMessage(loadingId, {
              content: "Sorry, I don't have command information for this canister type.",
              isLoading: false
            });
          }
          break;
          
        case 'whoami':
          try {
            // Get the principal from the actor method
            const response = await actor.whoami();
            
            // Store principal ID in interpreter memory
            interpreter.setVariable('userPrincipal', response.toText());
            
            updateMessage(loadingId, {
              content: nlpSystem.formatResponse('whoami', response, intent.entities),
              isLoading: false,
              result: response
            });
          } catch (error) {
            updateMessage(loadingId, {
              content: `Error executing whoami: ${error instanceof Error ? error.message : String(error)}`,
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        case 'start_token':
          if (wasmType === 'token_backend') {
            try {
              result = await actor.start_token();
              
              if ('Ok' in result) {
                // Store token ledger ID in interpreter memory
                interpreter.setVariable('ledgerId', result.Ok.toText());
                
                updateMessage(loadingId, {
                  content: nlpSystem.formatResponse('start_token', result, intent.entities),
                  isLoading: false,
                  result
                });
              } else {
                updateMessage(loadingId, {
                  content: `Failed to start token: ${result.Err}`,
                  isLoading: false,
                  type: 'error',
                  result
                });
              }
            } catch (error) {
              updateMessage(loadingId, {
                content: `Error executing start_token: ${error instanceof Error ? error.message : String(error)}`,
                isLoading: false,
                type: 'error'
              });
            }
          } else {
            updateMessage(loadingId, {
              content: 'The start_token command is only available for token_backend canisters.',
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        case 'register_miner':
          if (wasmType === 'token_backend') {
            try {
              result = await actor.register_miner();
              
              if ('Ok' in result) {
                // Store miner status in interpreter memory
                interpreter.setVariable('isMiner', true);
                
                updateMessage(loadingId, {
                  content: nlpSystem.formatResponse('register_miner', result, intent.entities),
                  isLoading: false,
                  result
                });
              } else {
                updateMessage(loadingId, {
                  content: `Failed to register as miner: ${result.Err}`,
                  isLoading: false,
                  type: 'error',
                  result
                });
              }
            } catch (error) {
              updateMessage(loadingId, {
                content: `Error executing register_miner: ${error instanceof Error ? error.message : String(error)}`,
                isLoading: false,
                type: 'error'
              });
            }
          } else {
            updateMessage(loadingId, {
              content: 'The register_miner command is only available for token_backend canisters.',
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        case 'deregister_miner':
          if (wasmType === 'token_backend') {
            try {
              result = await actor.deregister_miner();
              
              if ('Ok' in result) {
                // Update miner status in interpreter memory
                interpreter.setVariable('isMiner', false);
                
                updateMessage(loadingId, {
                  content: nlpSystem.formatResponse('deregister_miner', result, intent.entities),
                  isLoading: false,
                  result
                });
              } else {
                updateMessage(loadingId, {
                  content: `Failed to deregister as miner: ${result.Err}`,
                  isLoading: false,
                  type: 'error',
                  result
                });
              }
            } catch (error) {
              updateMessage(loadingId, {
                content: `Error executing deregister_miner: ${error instanceof Error ? error.message : String(error)}`,
                isLoading: false,
                type: 'error'
              });
            }
          } else {
            updateMessage(loadingId, {
              content: 'The deregister_miner command is only available for token_backend canisters.',
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        case 'get_info':
          if (wasmType === 'token_backend') {
            try {
              result = await actor.get_info();
              
              if ('Ok' in result) {
                // Store token info in interpreter memory
                interpreter.setVariable('tokenInfo', result.Ok);
                
                updateMessage(loadingId, {
                  content: nlpSystem.formatResponse('get_info', result, intent.entities),
                  isLoading: false,
                  result
                });
              } else {
                updateMessage(loadingId, {
                  content: `Failed to get token info: ${result.Err}`,
                  isLoading: false,
                  type: 'error',
                  result
                });
              }
            } catch (error) {
              updateMessage(loadingId, {
                content: `Error executing get_info: ${error instanceof Error ? error.message : String(error)}`,
                isLoading: false,
                type: 'error'
              });
            }
          } else {
            updateMessage(loadingId, {
              content: 'The get_info command is only available for token_backend canisters.',
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        case 'get_mining_info':
          if (wasmType === 'token_backend') {
            try {
              result = await actor.get_mining_info();
              
              // Store mining info in interpreter memory
              interpreter.setVariable('miningInfo', result);
              
              updateMessage(loadingId, {
                content: nlpSystem.formatResponse('get_mining_info', result, intent.entities),
                isLoading: false,
                result
              });
            } catch (error) {
              updateMessage(loadingId, {
                content: `Error executing get_mining_info: ${error instanceof Error ? error.message : String(error)}`,
                isLoading: false,
                type: 'error'
              });
            }
          } else {
            updateMessage(loadingId, {
              content: 'The get_mining_info command is only available for token_backend canisters.',
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        case 'get_miner_stats':
          if (wasmType === 'token_backend') {
            try {
              result = await actor.get_miner_stats();
              
              // Store miner stats in interpreter memory
              interpreter.setVariable('minerStats', result);
              
              updateMessage(loadingId, {
                content: nlpSystem.formatResponse('get_miner_stats', result, intent.entities),
                isLoading: false,
                result
              });
            } catch (error) {
              updateMessage(loadingId, {
                content: `Error executing get_miner_stats: ${error instanceof Error ? error.message : String(error)}`,
                isLoading: false,
                type: 'error'
              });
            }
          } else {
            updateMessage(loadingId, {
              content: 'The get_miner_stats command is only available for token_backend canisters.',
              isLoading: false,
              type: 'error'
            });
          }
          break;
          
        default:
          // Check if we can learn from this conversation
          if (intent.originalText.toLowerCase().includes("remember") || 
              intent.originalText.toLowerCase().includes("store")) {
            const rememberedContent = intent.originalText.replace(/remember|store/gi, '').trim();
            if (rememberedContent) {
              interpreter.setVariable('remembered', rememberedContent);
              updateMessage(loadingId, {
                content: `I'll remember that: "${rememberedContent}"`,
                isLoading: false
              });
              break;
            }
          }
          
          // Check if asking about remembered information
          if (intent.originalText.toLowerCase().includes("what did i tell you to remember") || 
              intent.originalText.toLowerCase().includes("what did i ask you to store")) {
            const remembered = interpreter.getVariable('remembered');
            if (remembered) {
              updateMessage(loadingId, {
                content: `You asked me to remember: "${remembered}"`,
                isLoading: false
              });
              break;
            }
          }
          
          updateMessage(loadingId, {
            content: nlpSystem.formatResponse('unknown', null, intent.entities),
            isLoading: false,
            type: 'error'
          });
      }
      
      // Log the memory state for debugging
      console.log('Interpreter memory after execution:', interpreter.getMemoryDump());
      
    } catch (error) {
      console.error('Error executing intent:', error);
      updateMessage(loadingId, {
        content: `Error processing your request: ${error instanceof Error ? error.message : String(error)}`,
        isLoading: false,
        type: 'error'
      });
    }
  }

  // Close the chat interface
  function closeChat() {
    dispatch('close');
  }

  // Chat container reference
  let chatContainer: HTMLElement;

  // Initialize on mount
  onMount(() => {
    initializeChat();
    createActor();
    scrollToBottom();
  });
</script>

<svelte:window on:mousemove={handleMouseMove}/>

<div class="kong-agent-overlay">
  <!-- Space Background -->
  <div class="space-background">
    <!-- Dark gradient base -->
    <div class="dark-gradient"></div>
    
    <!-- Nebula effect with parallax -->
    <div 
      class="nebula-effect"
      style="
        transform: translate({mouseX * 0.2}px, {mouseY * 0.2}px);
        --blue-x: {nebulaPositions.blue.x}%;
        --blue-y: {nebulaPositions.blue.y}%;
        --purple1-x: {nebulaPositions.purple1.x}%;
        --purple1-y: {nebulaPositions.purple1.y}%;
        --purple2-x: {nebulaPositions.purple2.x}%;
        --purple2-y: {nebulaPositions.purple2.y}%;
        --purple3-x: {nebulaPositions.purple3.x}%;
        --purple3-y: {nebulaPositions.purple3.y}%;
      "
    ></div>
    
    <!-- Enhanced 3D parallax stars -->
    <div class="stars-container">
      {#each [0, 1, 2] as layer}
        <div 
          class="stars-layer"
          style="transform: translate({mouseX * (0.05 + layer * 0.1)}px, {mouseY * (0.05 + layer * 0.1)}px)"
        >
          {#each stars.filter(star => star.depth === layer) as star}
            <div 
              class="star {star.twinkle ? 'twinkle' : ''}"
              style="
                --size: {star.size}px;
                --top: {star.top}%;
                --left: {star.left}%;
                --brightness: {star.brightness};
                --depth: {layer};"
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  <!-- Chat Interface Container -->
  <div class="chat-interface">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-content">
        <div class="agent-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9.504 1.132a1 1 0 01.992 0l1.75 1a1 1 0 11-.992 1.736L10 3.152l-1.254.716a1 1 0 11-.992-1.736l1.75-1zM5.618 4.504a1 1 0 01-.372 1.364L5.016 6l.23.132a1 1 0 11-.992 1.736L4 7.723V8a1 1 0 01-2 0V6a.996.996 0 01.52-.878l1.734-.99a1 1 0 011.364.372zm8.764 0a1 1 0 011.364-.372l1.733.99A1.002 1.002 0 0118 6v2a1 1 0 11-2 0v-.277l-.254.145a1 1 0 11-.992-1.736l.23-.132-.23-.132a1 1 0 01-.372-1.364zm-7 4a1 1 0 011.364-.372L10 8.848l1.254-.716a1 1 0 11.992 1.736L11 10.58V12a1 1 0 11-2 0v-1.42l-1.246-.712a1 1 0 01-.372-1.364zM3 11a1 1 0 011 1v1.42l1.246.712a1 1 0 11-.992 1.736l-1.75-1A1 1 0 012 14v-2a1 1 0 011-1zm14 0a1 1 0 011 1v2a1 1 0 01-.504.868l-1.75 1a1 1 0 11-.992-1.736L16 13.42V12a1 1 0 011-1zm-9.618 5.504a1 1 0 011.364-.372l.254.145V16a1 1 0 112 0v.277l.254-.145a1 1 0 11.992 1.736l-1.735.992a.995.995 0 01-1.022 0l-1.735-.992a1 1 0 01-.372-1.364z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="header-text">
          <h2>Kong Agent</h2>
          <p>Canister ID: {canisterId}</p>
        </div>
      </div>
      <button 
        on:click={closeChat}
        class="close-button"
        aria-label="Close chat"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    
    <!-- Chat Messages -->
    <div 
      class="chat-messages"
      bind:this={chatContainer}
    >
      <div class="messages-container">
        {#each messages as message (message.id)}
          <div class="message-wrapper {message.type === 'user' ? 'user-message' : ''}">
            <div 
              class="message {message.type}"
              in:fade={{ duration: 150, delay: 50 }}
            >
              {#if message.isLoading}
                <div class="loading-indicator">
                  <div class="dot"></div>
                  <div class="dot"></div>
                  <div class="dot"></div>
                </div>
              {:else}
                <div class="message-content">{message.content}</div>
              {/if}
              <div class="message-timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <!-- Input Area -->
    <div class="input-area">
      <form 
        on:submit|preventDefault={handleSubmit}
        class="input-form"
      >
        <input 
          type="text" 
          bind:value={inputMessage}
          placeholder="Ask a question or type a command (e.g., 'who am I?' or 'help')"
          class="command-input"
          disabled={isProcessing}
        />
        <button 
          type="submit"
          class="send-button"
          disabled={!inputMessage.trim() || isProcessing}
          aria-label="Send message"
        >
          {#if isProcessing}
            <svg class="loading-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" />
            </svg>
          {/if}
        </button>
      </form>
      <div class="help-text">
        Ask questions in natural language or type commands directly.
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  /* Main container */
  .kong-agent-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
  }

  /* Space background */
  .space-background {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
  }

  /* Dark gradient base */
  .dark-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgb(2, 6, 23) 0%,
      rgb(10, 15, 35) 100%
    );
    opacity: 0.95;
    backdrop-filter: blur(8px);
  }

  /* Nebula effect */
  .nebula-effect {
    position: absolute;
    inset: 0;
    filter: blur(80px);
    background: 
      radial-gradient(
        circle at var(--blue-x) var(--blue-y),
        rgba(30, 64, 175, 0.6),
        transparent 60%
      ),
      radial-gradient(
        circle at var(--purple1-x) var(--purple1-y),
        rgba(147, 51, 234, 0.5),
        transparent 60%
      ),
      radial-gradient(
        circle at var(--purple2-x) var(--purple2-y),
        rgba(88, 28, 135, 0.5),
        transparent 55%
      ),
      radial-gradient(
        circle at var(--purple3-x) var(--purple3-y),
        rgba(124, 58, 237, 0.5),
        transparent 60%
      );
    opacity: 0.3;
    will-change: transform;
  }

  /* Stars container */
  .stars-container {
    position: absolute;
    inset: 0;
    z-index: 1;
    perspective: 1000px;
  }

  .stars-layer {
    position: absolute;
    inset: 0;
    will-change: transform;
    transform-style: preserve-3d;
  }

  .star {
    position: absolute;
    width: var(--size);
    height: var(--size);
    background: white;
    border-radius: 50%;
    top: var(--top);
    left: var(--left);
    opacity: var(--brightness);
    box-shadow: 0 0 calc(var(--size) * 0.8) rgba(255, 255, 255, 0.8);
    transform: translateZ(calc(var(--depth) * 50px));
  }

  .star.twinkle {
    animation: twinkle 4s ease-in-out infinite;
    animation-delay: calc(var(--top) * 100ms);
  }

  @keyframes twinkle {
    0%, 100% { opacity: var(--brightness); }
    50% { opacity: calc(var(--brightness) * 0.3); }
  }

  /* Chat interface */
  .chat-interface {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 900px;
    height: 100vh;
    max-height: 700px;
    background: rgba(17, 24, 39, 0.7);
    backdrop-filter: blur(12px);
    border-radius: 16px;
    box-shadow: 
      0 0 0 1px rgba(255, 255, 255, 0.1),
      0 8px 20px rgba(0, 0, 0, 0.3),
      0 0 40px rgba(124, 58, 237, 0.2);
    overflow: hidden;
    animation: chat-appear 0.3s ease-out;
  }

  @keyframes chat-appear {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Chat header */
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(17, 24, 39, 0.8);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .agent-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 3rem;
    height: 3rem;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    border-radius: 12px;
    color: white;
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
    animation: pulse-subtle 3s infinite ease-in-out;
  }

  @keyframes pulse-subtle {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  .agent-icon svg {
    width: 1.75rem;
    height: 1.75rem;
  }

  .header-text h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .header-text p {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
  }

  .close-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    transform: rotate(90deg);
  }

  .close-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* Chat messages area */
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
    scroll-behavior: smooth;
  }

  .messages-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .message-wrapper {
    display: flex;
    justify-content: flex-start;
    width: 100%;
  }

  .message-wrapper.user-message {
    justify-content: flex-end;
  }

  .message {
    max-width: 80%;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    position: relative;
    overflow: hidden;
  }

  .message.system,
  .message.agent,
  .message.error {
    align-self: flex-start;
    margin-right: auto;
  }

  .message.user {
    align-self: flex-end;
    margin-left: auto;
  }

  .message::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    opacity: 0.7;
    backdrop-filter: blur(4px);
  }

  .message.system {
    background: rgba(31, 41, 55, 0.7);
    color: rgba(255, 255, 255, 0.9);
    border-left: 3px solid rgba(255, 255, 255, 0.3);
  }

  .message.agent {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(99, 102, 241, 0.3));
    color: white;
    border-left: 3px solid rgba(139, 92, 246, 0.7);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
  }

  .message.user {
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.3), rgba(67, 56, 202, 0.3));
    color: white;
    border-right: 3px solid rgba(79, 70, 229, 0.7);
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
  }

  .message.error {
    background: linear-gradient(135deg, rgba(220, 38, 38, 0.3), rgba(185, 28, 28, 0.3));
    color: white;
    border-left: 3px solid rgba(220, 38, 38, 0.7);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2);
  }

  .message-content {
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  .message-timestamp {
    font-size: 0.75rem;
    margin-top: 0.5rem;
    opacity: 0.7;
    text-align: right;
  }

  /* Loading indicator */
  .loading-indicator {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    height: 1.5rem;
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    background-color: white;
    border-radius: 50%;
    opacity: 0.7;
  }

  .dot:nth-child(1) {
    animation: dot-bounce 1.4s infinite ease-in-out;
    animation-delay: 0s;
  }

  .dot:nth-child(2) {
    animation: dot-bounce 1.4s infinite ease-in-out;
    animation-delay: 0.2s;
  }

  .dot:nth-child(3) {
    animation: dot-bounce 1.4s infinite ease-in-out;
    animation-delay: 0.4s;
  }

  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Input area */
  .input-area {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(17, 24, 39, 0.8);
  }

  .input-form {
    display: flex;
    gap: 0.75rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .command-input {
    flex: 1;
    padding: 0.75rem 1rem;
    background: rgba(31, 41, 55, 0.6);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    font-size: 0.9375rem;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }

  .command-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
    background: rgba(31, 41, 55, 0.8);
  }

  .command-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .command-input:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .send-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 2.75rem;
    height: 2.75rem;
    background: linear-gradient(135deg, #8b5cf6, #6366f1);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  }

  .send-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(139, 92, 246, 0.3);
  }

  .send-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .send-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .send-button svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .loading-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .help-text {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    margin-top: 0.5rem;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
  }

  /* Scrollbar styling */
  .chat-messages::-webkit-scrollbar {
    width: 6px;
  }

  .chat-messages::-webkit-scrollbar-track {
    background: rgba(31, 41, 55, 0.3);
    border-radius: 3px;
  }

  .chat-messages::-webkit-scrollbar-thumb {
    background: rgba(139, 92, 246, 0.5);
    border-radius: 3px;
  }

  .chat-messages::-webkit-scrollbar-thumb:hover {
    background: rgba(139, 92, 246, 0.7);
  }

  /* Animation utilities */
  @keyframes fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes flip {
    from { transform: translateY(10px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .chat-interface {
      width: 100%;
      height: 100%;
      max-height: none;
      border-radius: 0;
    }

    .message {
      max-width: 85%;
    }
  }

  @media (max-width: 480px) {
    .chat-header {
      padding: 0.75rem 1rem;
    }

    .agent-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .agent-icon svg {
      width: 1.5rem;
      height: 1.5rem;
    }

    .header-text h2 {
      font-size: 1.25rem;
    }

    .chat-messages {
      padding: 1rem;
    }

    .input-area {
      padding: 1rem;
    }

    .message {
      max-width: 90%;
    }
  }
</style>
