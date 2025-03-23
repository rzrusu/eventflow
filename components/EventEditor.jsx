import React, { useState, useEffect } from 'react';
import useStoryStore from '../src/store/storyStore';

const EventEditor = ({ eventId, eventData, availableEvents, onClose }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingEffects, setEditingEffects] = useState(false);
  const [currentOptionIndex, setCurrentOptionIndex] = useState(null);
  
  // Get the updateEvent function from the store
  const { updateEvent } = useStoryStore();
  
  // Initialize form with event data when available
  useEffect(() => {
    if (eventData) {
      setTitle(eventData.title || '');
      setContent(eventData.content || '');
      
      // Ensure all options have an effects array
      setOptions(eventData.options?.map(option => ({
        ...option,
        targets: option.targets || [],
        effects: option.effects || [] // Initialize effects array if not present
      })) || []);
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
        links
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
      effects: [] // Initialize empty effects array
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
      { skill: "", value: 0 } // Start with neutral value
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
          <label htmlFor="event-content">Content</label>
          <textarea
            id="event-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Event content"
            rows={4}
          />
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
                          {effect.skill} {effect.value > 0 ? `+${effect.value}` : effect.value}
                        </span>
                      ))}
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
      </div>
      
      <div className="event-editor-footer">
        <button 
          className="cancel-btn"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </button>
        <button 
          className="save-btn"
          onClick={handleSave}
          disabled={isLoading}
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
                      <input
                        type="text"
                        className="skill-input"
                        placeholder="Skill name"
                        value={effect.skill}
                        onChange={(e) => updateEffect(effectIndex, 'skill', e.target.value)}
                      />
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
      
      <style jsx>{`
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
        
        .skill-input {
          flex: 2;
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
      `}</style>
    </div>
  );
};

export default EventEditor; 