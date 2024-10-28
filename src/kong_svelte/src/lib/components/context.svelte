<script lang="ts">
    import Button from '$lib/components/common/Button.svelte';
    import Panel from '$lib/components/common/Panel.svelte';
    
    let demoStates: Array<'default' | 'pressed' | 'selected'> = Array(4).fill('default');
    
    function toggleState(index: number) {
      demoStates = demoStates.map((state, i) => {
        if (i === index) {
          return state === 'default' ? 'pressed' : 
                 state === 'pressed' ? 'selected' : 'default';
        }
        return state;
      });
    }
  </script>
  <!-- this file is mainly used to feed it to ai so it knows how to use the panel.svelte and button.svelte etc -->
  <div class="demo-container">
    <section class="demo-section">
      <h2>Size Variants</h2>
      <div class="button-row">
        <Button 
          text="Small Button" 
          size="small" 
          variant="blue"
          state={demoStates[0]}
          onClick={() => toggleState(0)}
        />
        <Button 
          text="Medium Button" 
          size="medium" 
          variant="blue"
          state={demoStates[0]}
          onClick={() => toggleState(0)}
        />
        <Button 
          text="Big Button" 
          size="big" 
          variant="blue"
          state={demoStates[0]}
          onClick={() => toggleState(0)}
        />
      </div>
    </section>
    
    <section class="demo-section">
      <h2>Color Variants</h2>
      <div class="button-row">
        <Button 
          text="Blue Button" 
          variant="blue"
          state={demoStates[1]}
          onClick={() => toggleState(1)}
        />
        <Button 
          text="Green Button" 
          variant="green"
          state={demoStates[1]}
          onClick={() => toggleState(1)}
        />
        <Button 
          text="Yellow Button" 
          variant="yellow"
          state={demoStates[1]}
          onClick={() => toggleState(1)}
        />
      </div>
    </section>
    
    <section class="demo-section">
      <h2>Interactive States</h2>
      <div class="button-row">
        <Button 
          text={`Current State: ${demoStates[2]}`}
          variant="blue"
          state={demoStates[2]}
          onClick={() => toggleState(2)}
        />
      </div>
      <p class="helper-text">Click to cycle through states: default → pressed → selected</p>
    </section>
    
    <section class="demo-section">
      <h2>Disabled State</h2>
      <div class="button-row">
        <Button 
          text="Disabled Button"
          variant="blue"
          disabled={true}
        />
        <Button 
          text="Disabled Green"
          variant="green"
          disabled={true}
        />
        <Button 
          text="Disabled Yellow"
          variant="yellow"
          disabled={true}
        />
      </div>
    </section>
  
    <section class="demo-section">
      <h2>Panels</h2>
      <div class="panel-grid">
        <!-- Main Panels -->
        <Panel 
          variant="green" 
          type="main"
          width={300}
          height={200}
          content="Green Main Panel"
        />
        <Panel 
          variant="green" 
          type="second"
          width={300}
          height={200}
          content="Green Secondary Panel"
        />
        <Panel 
          variant="yellow" 
          type="main"
          width={300}
          height={200}
          content="Yellow Main Panel"
        />
        
        <!-- Small Panels -->
        <Panel 
          variant="green" 
          type="s"
          width={200}
          height={150}
          content="Small Green Panel"
        />
        <Panel 
          variant="yellow" 
          type="second"
          width={200}
          height={150}
          content="Yellow Secondary Panel"
        />
      </div>
    </section>
  </div>
  
  <style>
    .demo-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      background-color: #f5f5f5;
    }
  
    h1 {
      font-size: 2rem;
      color: #333;
      margin-bottom: 2rem;
      text-align: center;
    }
  
    .demo-section {
      background-color: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  
    h2 {
      font-size: 1.5rem;
      color: #666;
      margin-bottom: 1.5rem;
    }
  
    .button-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }
  
    .panel-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }
  
    .helper-text {
      font-size: 0.875rem;
      color: #666;
      margin-top: 0.5rem;
      font-style: italic;
    }
  
    @media (max-width: 768px) {
      .panel-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
  