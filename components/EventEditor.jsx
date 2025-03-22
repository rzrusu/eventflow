import React, { useState, useEffect } from 'react';
import useStoryStore from '../src/store/storyStore';

const EventEditor = ({ eventId, eventData, availableEvents, onClose }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Get the updateEvent function from the store
  const { updateEvent } = useStoryStore();
  
  // Initialize form with event data when available
  useEffect(() => {
    if (eventData) {
      setTitle(eventData.title || '');
      setContent(eventData.content || '');
      setOptions(eventData.options?.map(option => ({
        ...option,
        nextEventId: option.nextEventId || null
      })) || []);
    }
  }, [eventData]);
  
  // Save event changes
  const handleSave = async () => {
    if (!eventId) return;
    
    try {
      setIsLoading(true);
      
      // Calculate links array based on the options' nextEventId values
      const links = options
        .map(option => option.nextEventId)
        .filter(id => id !== null && id !== undefined);
      
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
      nextEventId: null
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
                    <button 
                      className="remove-option-btn"
                      onClick={() => removeOption(index)}
                      title="Remove option"
                    >
                      ×
                    </button>
                  </div>
                  <div className="option-connection">
                    <label>Links to:</label>
                    <select
                      value={option.nextEventId || ''}
                      onChange={(e) => updateOption(index, 'nextEventId', e.target.value || null)}
                    >
                      <option value="">-- Not connected --</option>
                      {connectableEvents.map(event => (
                        <option key={event.id} value={event.id}>
                          {event.title || 'Untitled Event'}
                        </option>
                      ))}
                    </select>
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
        
        input, textarea, select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        
        textarea {
          resize: vertical;
        }
        
        .add-option-btn {
          background-color: #e3f2fd;
          color: #1976d2;
          border: 1px solid #bbdefb;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 10px;
        }
        
        .add-option-btn:hover {
          background-color: #bbdefb;
        }
        
        .no-options {
          color: #777;
          font-style: italic;
          margin-top: 10px;
        }
        
        .options-list {
          margin-top: 10px;
        }
        
        .option-item {
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 4px;
          background: #fafafa;
        }
        
        .option-row {
          display: flex;
          margin-bottom: 8px;
          align-items: center;
        }
        
        .option-row input {
          flex-grow: 1;
          margin-right: 8px;
        }
        
        .option-connection {
          display: flex;
          align-items: center;
          margin-top: 8px;
        }
        
        .option-connection label {
          display: inline;
          margin-right: 8px;
          min-width: 60px;
        }
        
        .option-connection select {
          flex-grow: 1;
        }
        
        .remove-option-btn {
          background-color: #ffebee;
          color: #d32f2f;
          border: 1px solid #ffcdd2;
          border-radius: 4px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 16px;
        }
        
        .remove-option-btn:hover {
          background-color: #ffcdd2;
        }
        
        .event-editor-footer {
          padding: 16px 20px;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        
        .cancel-btn {
          background-color: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .cancel-btn:hover {
          background-color: #e0e0e0;
        }
        
        .save-btn {
          background-color: #4caf50;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .save-btn:hover {
          background-color: #45a049;
        }
        
        .save-btn:disabled, .cancel-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default EventEditor; 