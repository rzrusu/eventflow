import React, { useState, useEffect } from 'react';
import useStoryStore from '../src/store/storyStore';
import { beautifyContent } from '../src/utils/geminiUtils';

// Define the available skill options
const SKILL_OPTIONS = {
  // Personality skills
  personality: [
    'temperament',
    'sociability',
    'leadershipStyle',
    'ambition',
    'professionalism',
    'adaptability',
    'pressureHandling',
    'loyalty'
  ],
  // Technical skills
  technical: [
    'technical',
    'corners',
    'crossing',
    'dribbling',
    'finishing',
    'freeKickAccuracy',
    'heading',
    'longShots',
    'longThrows',
    'marking',
    'passing',
    'penaltyTaking',
    'tackling',
    'technique'
  ],
  // Mental skills
  mental: [
    'aggression',
    'anticipation',
    'bravery',
    'composure',
    'concentration',
    'decisions',
    'determination',
    'flair',
    'leadership',
    'offTheBall',
    'positioning',
    'teamwork',
    'vision',
    'workRate'
  ],
  // Physical skills
  physical: [
    'acceleration',
    'agility',
    'balance',
    'jumpingReach',
    'naturalFitness',
    'pace',
    'stamina'
  ]
};

// Flatten all skills into a single array
const ALL_SKILLS = [
  ...SKILL_OPTIONS.personality,
  ...SKILL_OPTIONS.technical,
  ...SKILL_OPTIONS.mental,
  ...SKILL_OPTIONS.physical
];

// Helper function to format skill names for display
const formatSkillName = (skillName) => {
  if (!skillName) return '';
  // Add spaces before capital letters and capitalize the first letter
  return skillName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
};

const EventEditor = ({ eventId, eventData, availableEvents, onClose }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingEffects, setEditingEffects] = useState(false);
  const [editingSkillCheck, setEditingSkillCheck] = useState(false);
  const [editingTriggers, setEditingTriggers] = useState(false);
  const [currentOptionIndex, setCurrentOptionIndex] = useState(null);
  const [triggerRequirements, setTriggerRequirements] = useState([]);
  const [newTriggerKey, setNewTriggerKey] = useState('');
  const [newTriggerValue, setNewTriggerValue] = useState('');
  
  // AI Beautify state
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [beautifyError, setBeautifyError] = useState(null);
  
  // Get the updateEvent function from the store
  const { updateEvent } = useStoryStore();
  
  // Initialize form with event data when available
  useEffect(() => {
    if (eventData) {
      setTitle(eventData.title || '');
      setContent(eventData.content || '');
      
      // Ensure all options have an effects array and skillCheck property
      setOptions(eventData.options?.map(option => ({
        ...option,
        targets: option.targets || [],
        effects: option.effects || [], // Initialize effects array if not present
        skillCheck: option.skillCheck || null // Initialize skillCheck if not present
      })) || []);
      
      // Initialize trigger requirements
      setTriggerRequirements(eventData.triggerRequirements || []);
    }
  }, [eventData]);
  
  // Save event changes
  const handleSave = async () => {
    if (!eventId) return;
    
    try {
      setIsLoading(true);
      
      // Calculate links array based on all target eventIds
      const links = [];
      options.forEach(option => {
        if (option.targets && option.targets.length > 0) {
          option.targets.forEach(target => {
            if (target.eventId && !links.includes(target.eventId)) {
              links.push(target.eventId);
            }
          });
        }
      });
      
      // Update the event in the database
      await updateEvent(eventId, {
        title,
        content,
        options,
        links,
        triggerRequirements
      });
      
      // Close the editor
      onClose();
    } catch (err) {
      console.error('Error saving event', err);
      setError('Failed to save event data');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Add a new option
  const addOption = () => {
    setOptions([...options, {
      text: `Option ${options.length + 1}`,
      targets: [],
      effects: [], // Initialize empty effects array
      skillCheck: null // Initialize with no skill check
    }]);
  };
  
  // Update an option
  const updateOption = (index, field, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = {
      ...updatedOptions[index],
      [field]: value
    };
    setOptions(updatedOptions);
  };
  
  // Remove an option
  const removeOption = (index) => {
    setOptions(options.filter((_, i) => i !== index));
  };
  
  // Open the effects editor for an option
  const openEffectsEditor = (index) => {
    setCurrentOptionIndex(index);
    setEditingEffects(true);
  };
  
  // Add an effect to the current option
  const addEffect = () => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    updatedOptions[currentOptionIndex].effects = [
      ...(updatedOptions[currentOptionIndex].effects || []),
      { skill: ALL_SKILLS[0] || "", value: 0 } // Initialize with first skill in list
    ];
    setOptions(updatedOptions);
  };
  
  // Update an effect
  const updateEffect = (effectIndex, field, value) => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    
    if (field === 'value') {
      // Make sure we handle negative values correctly
      const numericValue = parseInt(value, 10);
      
      // If it's a valid number, use it (clamped between -100 and 100); otherwise default to 0
      if (!isNaN(numericValue)) {
        // Clamp value between -100 and 100
        const clampedValue = Math.max(-100, Math.min(100, numericValue));
        updatedOptions[currentOptionIndex].effects[effectIndex].value = clampedValue;
      } else {
        updatedOptions[currentOptionIndex].effects[effectIndex].value = 0;
      }
    } else {
      // For non-numeric fields (like skill name)
      updatedOptions[currentOptionIndex].effects[effectIndex][field] = value;
    }
    
    setOptions(updatedOptions);
  };
  
  // Remove an effect
  const removeEffect = (effectIndex) => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    updatedOptions[currentOptionIndex].effects = updatedOptions[currentOptionIndex].effects.filter((_, i) => i !== effectIndex);
    setOptions(updatedOptions);
  };
  
  // Handle value incrementing
  const incrementValue = (effectIndex) => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    const currentValue = updatedOptions[currentOptionIndex].effects[effectIndex].value;
    
    // Increment and clamp between -100 and 100
    updatedOptions[currentOptionIndex].effects[effectIndex].value = 
      Math.min(100, currentValue + 1);
    
    setOptions(updatedOptions);
  };
  
  // Handle value decrementing
  const decrementValue = (effectIndex) => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    const currentValue = updatedOptions[currentOptionIndex].effects[effectIndex].value;
    
    // Decrement and clamp between -100 and 100
    updatedOptions[currentOptionIndex].effects[effectIndex].value = 
      Math.max(-100, currentValue - 1);
    
    setOptions(updatedOptions);
  };
  
  // Open the skill check editor for an option
  const openSkillCheckEditor = (index) => {
    setCurrentOptionIndex(index);
    setEditingSkillCheck(true);
  };
  
  // Add a skill check to the current option
  const addSkillCheck = () => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    updatedOptions[currentOptionIndex].skillCheck = {
      skill: ALL_SKILLS[0] || "",
      minValue: 50 // Default to middle value
    };
    setOptions(updatedOptions);
  };
  
  // Update a skill check
  const updateSkillCheck = (field, value) => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    
    if (field === 'minValue') {
      // Make sure we handle numeric values correctly
      const numericValue = parseInt(value, 10);
      
      // If it's a valid number, use it (clamped between 0 and 100); otherwise default to 0
      if (!isNaN(numericValue)) {
        // Clamp value between 0 and 100
        const clampedValue = Math.max(0, Math.min(100, numericValue));
        updatedOptions[currentOptionIndex].skillCheck.minValue = clampedValue;
      } else {
        updatedOptions[currentOptionIndex].skillCheck.minValue = 0;
      }
    } else {
      // For non-numeric fields (like skill name)
      updatedOptions[currentOptionIndex].skillCheck[field] = value;
    }
    
    setOptions(updatedOptions);
  };
  
  // Remove a skill check
  const removeSkillCheck = () => {
    if (currentOptionIndex === null) return;
    
    const updatedOptions = [...options];
    updatedOptions[currentOptionIndex].skillCheck = null;
    setOptions(updatedOptions);
  };
  
  // Increment the minimum value for a skill check
  const incrementMinValue = () => {
    if (currentOptionIndex === null || !options[currentOptionIndex].skillCheck) return;
    
    const updatedOptions = [...options];
    const currentValue = updatedOptions[currentOptionIndex].skillCheck.minValue;
    
    // Increment and clamp between 0 and 100
    updatedOptions[currentOptionIndex].skillCheck.minValue = 
      Math.min(100, currentValue + 1);
    
    setOptions(updatedOptions);
  };
  
  // Decrement the minimum value for a skill check
  const decrementMinValue = () => {
    if (currentOptionIndex === null || !options[currentOptionIndex].skillCheck) return;
    
    const updatedOptions = [...options];
    const currentValue = updatedOptions[currentOptionIndex].skillCheck.minValue;
    
    // Decrement and clamp between 0 and 100 (skill check can't be negative)
    updatedOptions[currentOptionIndex].skillCheck.minValue = 
      Math.max(0, currentValue - 1);
    
    setOptions(updatedOptions);
  };
  
  // Close the skill check editor
  const closeSkillCheckEditor = () => {
    setEditingSkillCheck(false);
  };

  // Open trigger requirements editor
  const openTriggerEditor = () => {
    setEditingTriggers(true);
  };

  // Close trigger requirements editor
  const closeTriggerEditor = () => {
    setEditingTriggers(false);
  };

  // Add a new trigger requirement
  const addTriggerRequirement = () => {
    if (!newTriggerKey.trim() || !newTriggerValue.trim()) return;
    
    // Convert value to appropriate type
    let value = newTriggerValue.trim();
    
    // Convert to number if it's numeric
    if (!isNaN(value) && value !== '') {
      value = Number(value);
    } 
    // Convert to boolean if it's "true" or "false"
    else if (value.toLowerCase() === 'true') {
      value = true;
    } 
    else if (value.toLowerCase() === 'false') {
      value = false;
    }
    
    setTriggerRequirements([
      ...triggerRequirements,
      { key: newTriggerKey.trim(), value }
    ]);
    
    // Reset inputs
    setNewTriggerKey('');
    setNewTriggerValue('');
  };

  // Remove a trigger requirement
  const removeTriggerRequirement = (index) => {
    setTriggerRequirements(
      triggerRequirements.filter((_, i) => i !== index)
    );
  };
  
  // Handle AI beautify content
  const handleBeautifyContent = async () => {
    if (!content.trim()) {
      setBeautifyError("Please add some content to beautify");
      return;
    }

    try {
      setIsBeautifying(true);
      setBeautifyError(null);
      
      // Call the beautifyContent function from the utils
      const improvedContent = await beautifyContent(content);
      
      // Update the content state
      setContent(improvedContent);
    } catch (error) {
      console.error("Error beautifying content:", error);
      setBeautifyError(error.message || "Failed to beautify content");
    } finally {
      setIsBeautifying(false);
    }
  };
  
  if (!eventData) {
    return <div className="event-editor error">Event data not available</div>;
  }
  
  // Filter out the current event from available options
  const connectableEvents = availableEvents?.filter(event => event.id !== eventId) || [];
  
  return (
    <div className="event-editor">
      <div className="event-editor-header">
        <h2>Edit Event</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="event-editor-content">
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="event-title">Title</label>
          <input
            id="event-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
          />
        </div>
        
        <div className="form-group">
          <div className="content-header">
            <label htmlFor="event-content">Content</label>
            <button 
              className="ai-beautify-btn"
              onClick={handleBeautifyContent}
              disabled={isBeautifying || !content.trim()}
              title="Use AI to improve writing"
            >
              {isBeautifying ? 'Processing...' : '✨ AI Beautify'}
            </button>
          </div>
          {beautifyError && <div className="error-message">{beautifyError}</div>}
          <textarea
            id="event-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Event content"
            rows={4}
          />
          {isBeautifying && (
            <div className="beautify-loading">
              <div className="spinner"></div>
              <span>Gemini 2.0 Flash is improving your text...</span>
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label>Options</label>
          <button className="add-option-btn" onClick={addOption}>
            Add Option
          </button>
          
          {options.length === 0 ? (
            <p className="no-options">No options yet. Add some to give players choices.</p>
          ) : (
            <div className="options-list">
              {options.map((option, index) => (
                <div key={index} className="option-item">
                  <div className="option-row">
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => updateOption(index, 'text', e.target.value)}
                      placeholder="Option text"
                    />
                    <div className="option-buttons">
                      <button 
                        className="effects-btn"
                        onClick={() => openEffectsEditor(index)}
                        title="Edit effects"
                      >
                        🎮 Effects {option.effects && option.effects.length > 0 ? `(${option.effects.length})` : ''}
                      </button>
                      <button 
                        className="skill-check-btn"
                        onClick={() => openSkillCheckEditor(index)}
                        title="Edit skill check"
                      >
                        🎯 Skill Check {option.skillCheck ? '✓' : ''}
                      </button>
                      <button 
                        className="remove-option-btn"
                        onClick={() => removeOption(index)}
                        title="Remove option"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* Effects summary display */}
                  {option.effects && option.effects.length > 0 && (
                    <div className="effects-summary">
                      {option.effects.map((effect, i) => (
                        <span key={i} className="effect-tag">
                          {formatSkillName(effect.skill)} {effect.value > 0 ? `+${effect.value}` : effect.value}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Skill check summary display */}
                  {option.skillCheck && (
                    <div className="skill-check-summary">
                      <span className="skill-check-tag">
                        Requires {formatSkillName(option.skillCheck.skill)}: {option.skillCheck.minValue}+
                      </span>
                    </div>
                  )}
                  
                  <div className="option-connections">
                    <label>Connections:</label>
                    <div className="connections-info">
                      {option.targets && option.targets.length > 0 ? (
                        <div>
                          {option.targets.map((target, i) => {
                            const targetEvent = connectableEvents.find(e => e.id === target.eventId);
                            return (
                              <div key={i} className="connection-item">
                                {targetEvent ? targetEvent.title : 'Unknown Event'} 
                                ({Math.round((target.probability || 0) * 100)}%)
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="no-connections">Not connected to any events</span>
                      )}
                      <div className="connection-note">
                        (Use the flow editor to manage connections)
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Trigger Requirements Section */}
        <div className="form-group">
          <div className="triggers-header">
            <label>Trigger Requirements</label>
            <button 
              className="edit-triggers-btn"
              onClick={openTriggerEditor}
              title="Edit Trigger Requirements"
            >
              Edit Requirements
            </button>
          </div>
          
          {triggerRequirements.length > 0 ? (
            <div className="triggers-summary">
              {triggerRequirements.map((trigger, index) => (
                <div key={index} className="trigger-tag">
                  {trigger.key}: {trigger.value}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-triggers">No trigger requirements set. This event will always be accessible.</p>
          )}
        </div>
      </div>
      
      <div className="event-editor-footer">
        <button 
          className="cancel-btn"
          onClick={onClose}
          disabled={isLoading || isBeautifying}
        >
          Cancel
        </button>
        <button 
          className="save-btn"
          onClick={handleSave}
          disabled={isLoading || isBeautifying}
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      
      {/* Effects Editor Modal */}
      {editingEffects && currentOptionIndex !== null && (
        <div className="effects-editor-backdrop">
          <div className="effects-editor">
            <div className="effects-editor-header">
              <h3>Edit Effects for "{options[currentOptionIndex].text}"</h3>
              <button 
                className="close-effects-btn"
                onClick={() => setEditingEffects(false)}
              >
                ×
              </button>
            </div>
            
            <div className="effects-editor-content">
              <h4>Effects Editor</h4>
              <p className="effects-help">
                Define skill modifications for this option. Skills can be adjusted between -100 and +100.
                Use positive values to increase skills and negative values to decrease skills.
              </p>
              
              <button 
                className="add-effect-btn"
                onClick={addEffect}
              >
                Add Effect
              </button>
              
              {options[currentOptionIndex].effects && options[currentOptionIndex].effects.length > 0 ? (
                <div className="effects-list">
                  {options[currentOptionIndex].effects.map((effect, effectIndex) => (
                    <div key={effectIndex} className="effect-item">
                      <div className="skill-select-container">
                        <select
                          className="skill-select"
                          value={effect.skill}
                          onChange={(e) => updateEffect(effectIndex, 'skill', e.target.value)}
                        >
                          <option value="">-- Select a Skill --</option>
                          <optgroup label="Personality">
                            {SKILL_OPTIONS.personality.map(skill => (
                              <option key={skill} value={skill}>
                                {formatSkillName(skill)}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Technical">
                            {SKILL_OPTIONS.technical.map(skill => (
                              <option key={skill} value={skill}>
                                {formatSkillName(skill)}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Mental">
                            {SKILL_OPTIONS.mental.map(skill => (
                              <option key={skill} value={skill}>
                                {formatSkillName(skill)}
                              </option>
                            ))}
                          </optgroup>
                          <optgroup label="Physical">
                            {SKILL_OPTIONS.physical.map(skill => (
                              <option key={skill} value={skill}>
                                {formatSkillName(skill)}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      <div className="value-control">
                        <button 
                          className="value-btn decrease-btn" 
                          onClick={() => decrementValue(effectIndex)}
                          type="button"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="value-input"
                          placeholder="Value"
                          value={effect.value}
                          onChange={(e) => updateEffect(effectIndex, 'value', e.target.value)}
                          min="-100"
                          max="100"
                        />
                        <button 
                          className="value-btn increase-btn" 
                          onClick={() => incrementValue(effectIndex)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      <button 
                        className="remove-effect-btn" 
                        onClick={() => removeEffect(effectIndex)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-effects">
                  No effects added yet. Add some to modify player skills when this option is chosen.
                </p>
              )}
            </div>
            
            <div className="effects-editor-footer">
              <button 
                className="close-effects-btn"
                onClick={() => setEditingEffects(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Skill Check Editor Modal */}
      {editingSkillCheck && currentOptionIndex !== null && (
        <div className="skill-check-editor-backdrop">
          <div className="skill-check-editor">
            <div className="skill-check-editor-header">
              <h3>Edit Skill Check for "{options[currentOptionIndex].text}"</h3>
              <button 
                className="close-skill-check-btn"
                onClick={closeSkillCheckEditor}
              >
                ×
              </button>
            </div>
            
            <div className="skill-check-editor-content">
              <h4>Skill Check Editor</h4>
              <p className="skill-check-help">
                Define a skill check for this option. If the player's skill level meets or exceeds the minimum value,
                they will pass the check. You can then connect this option to different events based on success or failure.
              </p>
              
              {!options[currentOptionIndex].skillCheck ? (
                <button 
                  className="add-skill-check-btn"
                  onClick={addSkillCheck}
                >
                  Add Skill Check
                </button>
              ) : (
                <div className="skill-check-form">
                  <div className="skill-check-row">
                    <div className="skill-select-container">
                      <select
                        className="skill-select"
                        value={options[currentOptionIndex].skillCheck.skill}
                        onChange={(e) => updateSkillCheck('skill', e.target.value)}
                      >
                        <option value="">-- Select a Skill --</option>
                        <optgroup label="Personality">
                          {SKILL_OPTIONS.personality.map(skill => (
                            <option key={skill} value={skill}>
                              {formatSkillName(skill)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Technical">
                          {SKILL_OPTIONS.technical.map(skill => (
                            <option key={skill} value={skill}>
                              {formatSkillName(skill)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Mental">
                          {SKILL_OPTIONS.mental.map(skill => (
                            <option key={skill} value={skill}>
                              {formatSkillName(skill)}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Physical">
                          {SKILL_OPTIONS.physical.map(skill => (
                            <option key={skill} value={skill}>
                              {formatSkillName(skill)}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="value-control">
                      <button 
                        className="value-btn decrease-btn" 
                        onClick={decrementMinValue}
                        type="button"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="value-input"
                        placeholder="Min Value"
                        value={options[currentOptionIndex].skillCheck.minValue}
                        onChange={(e) => updateSkillCheck('minValue', e.target.value)}
                        min="0"
                        max="100"
                      />
                      <button 
                        className="value-btn increase-btn" 
                        onClick={incrementMinValue}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                    <button 
                      className="remove-skill-check-btn" 
                      onClick={removeSkillCheck}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                  <div className="connection-note">
                    After saving, use the flow editor to connect Success/Failure paths to different events
                  </div>
                </div>
              )}
            </div>
            
            <div className="skill-check-editor-footer">
              <button 
                className="close-skill-check-btn"
                onClick={closeSkillCheckEditor}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Trigger Requirements Editor Modal */}
      {editingTriggers && (
        <div className="effects-editor-backdrop">
          <div className="triggers-editor">
            <div className="triggers-editor-header">
              <h3>Edit Trigger Requirements</h3>
              <button 
                className="close-triggers-btn"
                onClick={closeTriggerEditor}
              >
                ×
              </button>
            </div>
            
            <div className="triggers-editor-content">
              <p className="triggers-help">
                Trigger requirements define conditions that must be met for this event to be accessible.
                Examples: <code>playerLevel: 5</code>, <code>hasItem: true</code>, <code>questCompleted: "mainQuest"</code>
              </p>
              
              <div className="current-triggers">
                <h4>Current Requirements</h4>
                {triggerRequirements.length > 0 ? (
                  <ul className="triggers-list">
                    {triggerRequirements.map((trigger, index) => (
                      <li key={index} className="trigger-item">
                        <span className="trigger-key">{trigger.key}:</span>
                        <span className="trigger-value">{trigger.value}</span>
                        <button 
                          className="remove-trigger-btn"
                          onClick={() => removeTriggerRequirement(index)}
                          title="Remove Requirement"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-triggers-set">No requirements set.</p>
                )}
              </div>
              
              <div className="add-trigger-form">
                <h4>Add New Requirement</h4>
                <div className="trigger-inputs">
                  <input
                    type="text"
                    className="trigger-key-input"
                    value={newTriggerKey}
                    onChange={(e) => setNewTriggerKey(e.target.value)}
                    placeholder="Key (e.g. playerLevel)"
                  />
                  <input
                    type="text"
                    className="trigger-value-input"
                    value={newTriggerValue}
                    onChange={(e) => setNewTriggerValue(e.target.value)}
                    placeholder="Value (e.g. 5)"
                  />
                  <button 
                    className="add-trigger-btn"
                    onClick={addTriggerRequirement}
                    disabled={!newTriggerKey.trim() || !newTriggerValue.trim()}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            
            <div className="triggers-editor-footer">
              <button 
                className="close-triggers-btn-footer"
                onClick={closeTriggerEditor}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .event-editor {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 500px;
          max-width: 90vw;
          background: white;
          border-radius: 8px;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          z-index: 1000;
        }
        
        .event-editor-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .event-editor-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }
        
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #777;
        }
        
        .close-btn:hover {
          color: #333;
        }
        
        .event-editor-content {
          padding: 20px;
          overflow-y: auto;
          max-height: 60vh;
        }
        
        .error-message {
          background-color: #ffebee;
          color: #d32f2f;
          padding: 10px;
          margin-bottom: 15px;
          border-radius: 4px;
          border: 1px solid #ffcdd2;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          font-size: 14px;
          color: #555;
        }
        
        input[type="text"],
        textarea,
        select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        }
        
        textarea {
          resize: vertical;
        }
        
        .add-option-btn {
          background-color: #2196f3;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 10px;
        }
        
        .add-option-btn:hover {
          background-color: #1e88e5;
        }
        
        .no-options {
          font-style: italic;
          color: #777;
        }
        
        .options-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .option-item {
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 12px;
        }
        
        .option-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        
        .option-buttons {
          display: flex;
          gap: 5px;
        }
        
        .effects-btn {
          padding: 6px 10px;
          background: #673ab7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        
        .effects-btn:hover {
          background: #5e35b1;
        }
        
        .effects-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 10px;
        }
        
        .effect-tag {
          background: #e3f2fd;
          color: #1976d2;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 12px;
          border: 1px solid #bbdefb;
        }
        
        .option-connections {
          margin-top: 10px;
          font-size: 13px;
        }
        
        .connections-info {
          margin-top: 5px;
          color: #555;
        }
        
        .connection-item {
          margin-bottom: 3px;
        }
        
        .no-connections {
          font-style: italic;
          color: #777;
        }
        
        .connection-note {
          font-style: italic;
          color: #777;
          margin-top: 5px;
          font-size: 12px;
        }
        
        .remove-option-btn {
          background: #f44336;
          color: white;
          border: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
        }
        
        .remove-option-btn:hover {
          background: #e53935;
        }
        
        .event-editor-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        
        .cancel-btn {
          padding: 8px 16px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .cancel-btn:hover {
          background: #e0e0e0;
        }
        
        .save-btn {
          padding: 8px 16px;
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .save-btn:hover {
          background: #43a047;
        }
        
        .save-btn:disabled,
        .cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* Effects Editor Styles */
        .effects-editor-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
        }
        
        .effects-editor {
          background: white;
          border-radius: 8px;
          width: 500px;
          max-width: 90vw;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        
        .effects-editor-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .effects-editor-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
        }
        
        .close-effects-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #777;
        }
        
        .effects-editor-content {
          padding: 20px;
          overflow-y: auto;
          max-height: 60vh;
        }
        
        .effects-help {
          margin-top: 0;
          margin-bottom: 15px;
          color: #555;
          font-size: 14px;
        }
        
        .add-effect-btn {
          padding: 8px 16px;
          background: #673ab7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 15px;
        }
        
        .add-effect-btn:hover {
          background: #5e35b1;
        }
        
        .effects-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .effect-item {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .skill-select-container {
          flex: 2;
        }
        
        .skill-select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          height: 36px;
          background-color: white;
        }
        
        .value-control {
          display: flex;
          align-items: center;
          flex: 1;
        }
        
        .value-input {
          width: 60px;
          text-align: center;
          border-radius: 0;
        }
        
        .value-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f1f1;
          border: 1px solid #ddd;
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          padding: 0;
        }
        
        .decrease-btn {
          border-radius: 4px 0 0 4px;
          border-right: none;
          color: #d32f2f;
        }
        
        .increase-btn {
          border-radius: 0 4px 4px 0;
          border-left: none;
          color: #4caf50;
        }
        
        .value-btn:hover {
          background: #e5e5e5;
        }
        
        .remove-effect-btn {
          background: #f44336;
          color: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
        }
        
        .remove-effect-btn:hover {
          background: #e53935;
        }
        
        .no-effects {
          font-style: italic;
          color: #777;
          text-align: center;
        }
        
        .effects-editor-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
        }
        
        /* Skill Check Editor Styles */
        .skill-check-editor-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1200;
        }
        
        .skill-check-editor {
          background: white;
          border-radius: 8px;
          width: 500px;
          max-width: 90vw;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        
        .skill-check-editor-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .skill-check-editor-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
        }
        
        .close-skill-check-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #777;
        }
        
        .skill-check-editor-content {
          padding: 20px;
          overflow-y: auto;
          max-height: 60vh;
        }
        
        .skill-check-help {
          margin-top: 0;
          margin-bottom: 15px;
          color: #555;
          font-size: 14px;
        }
        
        .add-skill-check-btn {
          padding: 8px 16px;
          background: #673ab7;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 15px;
        }
        
        .add-skill-check-btn:hover {
          background: #5e35b1;
        }
        
        .skill-check-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .skill-check-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        
        .skill-select-container {
          flex: 2;
        }
        
        .skill-select {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          height: 36px;
          background-color: white;
        }
        
        .value-control {
          display: flex;
          align-items: center;
          flex: 1;
        }
        
        .value-input {
          width: 60px;
          text-align: center;
          border-radius: 0;
        }
        
        .value-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f1f1f1;
          border: 1px solid #ddd;
          cursor: pointer;
          font-weight: bold;
          font-size: 16px;
          padding: 0;
        }
        
        .decrease-btn {
          border-radius: 4px 0 0 4px;
          border-right: none;
          color: #d32f2f;
        }
        
        .increase-btn {
          border-radius: 0 4px 4px 0;
          border-left: none;
          color: #4caf50;
        }
        
        .value-btn:hover {
          background: #e5e5e5;
        }
        
        .remove-skill-check-btn {
          background: #f44336;
          color: white;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
        }
        
        .remove-skill-check-btn:hover {
          background: #e53935;
        }
        
        .no-skill-check {
          font-style: italic;
          color: #777;
          text-align: center;
        }
        
        .skill-check-editor-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
        }
        
        .skill-check-btn {
          padding: 6px 10px;
          background: #ff9800;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }
        
        .skill-check-btn:hover {
          background: #f57c00;
        }
        
        .skill-check-summary {
          margin-top: 5px;
          margin-bottom: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        
        .skill-check-tag {
          background: #fff3e0;
          color: #e65100;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 12px;
          border: 1px solid #ffe0b2;
          display: flex;
          align-items: center;
        }
        
        /* Trigger Requirements Styles */
        .triggers-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .edit-triggers-btn {
          padding: 4px 8px;
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .edit-triggers-btn:hover {
          background: #e0e0e0;
        }
        
        .triggers-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 10px;
        }
        
        .trigger-tag {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 3px 6px;
          border-radius: 4px;
          font-size: 12px;
          border: 1px solid #c8e6c9;
        }
        
        .no-triggers {
          font-style: italic;
          color: #777;
          font-size: 13px;
        }
        
        /* Trigger Requirements Editor Styles */
        .triggers-editor {
          background: white;
          border-radius: 8px;
          width: 500px;
          max-width: 90vw;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }
        
        .triggers-editor-header {
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .triggers-editor-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
        }
        
        .close-triggers-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #777;
        }
        
        .triggers-editor-content {
          padding: 20px;
          overflow-y: auto;
          max-height: 60vh;
        }
        
        .triggers-help {
          margin-top: 0;
          margin-bottom: 15px;
          color: #555;
          font-size: 14px;
        }
        
        .triggers-help code {
          background: #f5f5f5;
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 12px;
          color: #e91e63;
        }
        
        .current-triggers h4, .add-trigger-form h4 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 14px;
          font-weight: 500;
        }
        
        .triggers-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .trigger-item {
          display: flex;
          align-items: center;
          padding: 8px 10px;
          background: #f9f9f9;
          border-radius: 4px;
          margin-bottom: 5px;
        }
        
        .trigger-key {
          font-weight: 500;
          margin-right: 5px;
          color: #333;
        }
        
        .trigger-value {
          color: #4caf50;
          flex-grow: 1;
        }
        
        .remove-trigger-btn {
          background: none;
          border: none;
          color: #f44336;
          font-size: 16px;
          cursor: pointer;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        
        .remove-trigger-btn:hover {
          background: rgba(244, 67, 54, 0.1);
        }
        
        .no-triggers-set {
          font-style: italic;
          color: #777;
          font-size: 13px;
        }
        
        .add-trigger-form {
          margin-top: 20px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        
        .trigger-inputs {
          display: flex;
          gap: 8px;
        }
        
        .trigger-key-input, .trigger-value-input {
          flex: 1;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        .add-trigger-btn {
          background: #4caf50;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0 15px;
          cursor: pointer;
        }
        
        .add-trigger-btn:hover {
          background: #43a047;
        }
        
        .add-trigger-btn:disabled {
          background: #a5d6a7;
          cursor: not-allowed;
        }
        
        .triggers-editor-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
        }
        
        .close-triggers-btn-footer {
          padding: 8px 16px;
          background: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .close-triggers-btn-footer:hover {
          background: #1e88e5;
        }
        
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .ai-beautify-btn {
          background-color: #8e44ad;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 12px;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background-color 0.2s;
        }
        
        .ai-beautify-btn:hover {
          background-color: #7d3c98;
        }
        
        .ai-beautify-btn:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
        
        .beautify-loading {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
          font-size: 14px;
          color: #8e44ad;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(142, 68, 173, 0.3);
          border-radius: 50%;
          border-top-color: #8e44ad;
          animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EventEditor; 