import React, { useState, useEffect } from 'react';
import StoryFlow from '../components/StoryFlow';
import useStoryStore from '../src/store/storyStore';
import '../styles/StoryFlow.css';

const StoryEditor = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [editingStorylineId, setEditingStorylineId] = useState(null);
  const [editedTitle, setEditedTitle] = useState("");
  
  // Get state and actions from the store
  const { 
    stories,
    storylines,
    activeStoryId, 
    activeStorylineId,
    isLoading,
    error,
    loadStories,
    createStory,
    updateStory,
    deleteStory,
    setActiveStory,
    loadStorylines,
    createStoryline,
    updateStoryline,
    deleteStoryline,
    setActiveStoryline,
    initializeSampleData
  } = useStoryStore();
  
  // Load stories on component mount
  useEffect(() => {
    const initialize = async () => {
      await loadStories();
      setIsInitializing(false);
    };
    initialize();
  }, [loadStories]);
  
  // Load sample data if no stories exist
  useEffect(() => {
    if (!isInitializing && stories.length === 0) {
      initializeSampleData();
    }
  }, [isInitializing, stories, initializeSampleData]);
  
  // Load storylines when activeStoryId changes
  useEffect(() => {
    if (activeStoryId) {
      loadStorylines(activeStoryId);
    }
  }, [activeStoryId, loadStorylines]);
  
  // Create a new story
  const handleCreateStory = async () => {
    const newStoryId = await createStory({
      title: `New Story ${stories.length + 1}`,
      description: 'Add a description'
    });
    
    if (newStoryId) {
      setActiveStory(newStoryId);
    }
  };
  
  // Create a new storyline
  const handleCreateStoryline = async () => {
    if (!activeStoryId) return;
    
    const storylines = await loadStorylines(activeStoryId);
    const newStorylineId = await createStoryline(activeStoryId, {
      title: `New Storyline ${storylines.length + 1}`,
      description: 'Add a description'
    });
    
    if (newStorylineId) {
      setActiveStoryline(newStorylineId);
    }
  };
  
  // Get the active story object
  const getActiveStory = () => {
    return stories.find(s => s.id === activeStoryId);
  };
  
  // Get the active storyline object
  const getActiveStoryline = () => {
    return storylines.find(sl => sl.id === activeStorylineId);
  };
  
  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  // Handle story click
  const handleStoryClick = (storyId) => {
    setActiveStory(storyId);
  };
  
  // Handle story deletion
  const handleDeleteStory = async (event, storyId) => {
    // Stop the click event from propagating to the parent li which would select the story
    event.stopPropagation();
    
    // Ask for confirmation
    const confirmed = window.confirm('Are you sure you want to delete this story? This will delete all storylines and events within it and cannot be undone.');
    
    if (confirmed) {
      await deleteStory(storyId);
      // If this was the active story, the store will handle setting activeStoryId to null
    }
  };
  
  // Handle storyline deletion
  const handleDeleteStoryline = async (event, storylineId) => {
    // Stop the click event from propagating to the parent li which would select the storyline
    event.stopPropagation();
    
    // Ask for confirmation
    const confirmed = window.confirm('Are you sure you want to delete this storyline? This will delete all events within it and cannot be undone.');
    
    if (confirmed) {
      await deleteStoryline(storylineId);
      // If this was the active storyline, the store will handle setting activeStorylineId to null
      
      // Refresh storylines list after deletion
      if (activeStoryId) {
        await loadStorylines(activeStoryId);
      }
    }
  };
  
  // Get active storyline title
  const getActiveStorylineTitle = () => {
    const storyline = getActiveStoryline();
    return storyline ? storyline.title : 'Select a Storyline';
  };

  // Handle story edit button click
  const handleEditStoryClick = (event, story) => {
    event.stopPropagation();
    setEditingStoryId(story.id);
    setEditedTitle(story.title);
  };

  // Handle storyline edit button click
  const handleEditStorylineClick = (event, storyline) => {
    event.stopPropagation();
    setEditingStorylineId(storyline.id);
    setEditedTitle(storyline.title);
  };

  // Handle title input change
  const handleTitleChange = (event) => {
    setEditedTitle(event.target.value);
  };

  // Handle save story title
  const handleSaveStoryTitle = async (event, storyId) => {
    event.stopPropagation();
    if (editedTitle.trim() === "") return;
    
    const updatedStory = await updateStory(storyId, { title: editedTitle });
    if (updatedStory) {
      // Force reload stories to get the updated data
      await loadStories();
      console.log("Story title updated:", editedTitle);
    }
    setEditingStoryId(null);
  };

  // Handle save storyline title
  const handleSaveStorylineTitle = async (event, storylineId) => {
    event.stopPropagation();
    if (editedTitle.trim() === "") return;
    
    const updatedStoryline = await updateStoryline(storylineId, { title: editedTitle });
    if (updatedStoryline) {
      // Force reload storylines to get the updated data
      if (activeStoryId) {
        await loadStorylines(activeStoryId);
      }
      console.log("Storyline title updated:", editedTitle);
    }
    setEditingStorylineId(null);
  };

  // Handle key press in title input
  const handleTitleKeyPress = async (event, type, id) => {
    if (event.key === 'Enter') {
      if (type === 'story') {
        await handleSaveStoryTitle(event, id);
      } else {
        await handleSaveStorylineTitle(event, id);
      }
    } else if (event.key === 'Escape') {
      if (type === 'story') {
        setEditingStoryId(null);
      } else {
        setEditingStorylineId(null);
      }
    }
  };

  // Cancel editing when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if we're currently editing
      if (editingStoryId || editingStorylineId) {
        // If the click target is not an input or a button, cancel editing
        if (!event.target.closest('.title-input') && 
            !event.target.closest('.save-btn') && 
            !event.target.closest('.edit-btn')) {
          setEditingStoryId(null);
          setEditingStorylineId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingStoryId, editingStorylineId]);

  return (
    <div className="story-editor-container">
      {/* Collapsible Sidebar */}
      <div className={`story-editor-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-section">
              <h2>Stories</h2>
              <button onClick={handleCreateStory} className="create-btn">+ New Story</button>
              <ul className="story-list">
                {stories.map(story => (
                  <li 
                    key={story.id} 
                    className={activeStoryId === story.id ? 'active' : ''}
                  >
                    <div 
                      className="story-item" 
                      onClick={() => handleStoryClick(story.id)}
                    >
                      {editingStoryId === story.id ? (
                        <input
                          type="text"
                          className="title-input"
                          value={editedTitle}
                          onChange={handleTitleChange}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => handleTitleKeyPress(e, 'story', story.id)}
                          autoFocus
                        />
                      ) : (
                        <span className="story-title">{story.title}</span>
                      )}
                    </div>
                    <div className="item-actions">
                      {editingStoryId === story.id ? (
                        <button 
                          className="save-btn" 
                          onClick={(e) => handleSaveStoryTitle(e, story.id)}
                          title="Save Title"
                        >
                          ✓
                        </button>
                      ) : (
                        <button 
                          className="edit-btn" 
                          onClick={(e) => handleEditStoryClick(e, story)}
                          title="Edit Title"
                        >
                          ✏️
                        </button>
                      )}
                      <button 
                        className="delete-btn" 
                        onClick={(e) => handleDeleteStory(e, story.id)}
                        title="Delete Story"
                      >
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            
            {activeStoryId && (
              <div className="sidebar-section">
                <h2>Storylines</h2>
                <button onClick={handleCreateStoryline} className="create-btn">+ New Storyline</button>
                <ul className="storyline-list">
                  {isLoading ? (
                    <li className="loading">Loading storylines...</li>
                  ) : (
                    storylines.map(storyline => (
                      <li 
                        key={storyline.id} 
                        className={activeStorylineId === storyline.id ? 'active' : ''}
                      >
                        <div 
                          className="storyline-item" 
                          onClick={() => setActiveStoryline(storyline.id)}
                        >
                          {editingStorylineId === storyline.id ? (
                            <input
                              type="text"
                              className="title-input"
                              value={editedTitle}
                              onChange={handleTitleChange}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => handleTitleKeyPress(e, 'storyline', storyline.id)}
                              autoFocus
                            />
                          ) : (
                            <span className="storyline-title">{storyline.title}</span>
                          )}
                        </div>
                        <div className="item-actions">
                          {editingStorylineId === storyline.id ? (
                            <button 
                              className="save-btn" 
                              onClick={(e) => handleSaveStorylineTitle(e, storyline.id)}
                              title="Save Title"
                            >
                              ✓
                            </button>
                          ) : (
                            <button 
                              className="edit-btn" 
                              onClick={(e) => handleEditStorylineClick(e, storyline)}
                              title="Edit Title"
                            >
                              ✏️
                            </button>
                          )}
                          <button 
                            className="delete-btn" 
                            onClick={(e) => handleDeleteStoryline(e, storyline.id)}
                            title="Delete Storyline"
                          >
                            🗑️
                          </button>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </>
        )}
        <button 
          className="sidebar-toggle" 
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>
      
      {/* Main Content Area */}
      <div className="story-editor-content">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading...</p>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        
        {activeStoryId && activeStorylineId ? (
          <>
            <div className="content-header">
              <h1>{getActiveStory()?.title || 'Select a Story'} / {getActiveStorylineTitle()}</h1>
            </div>
            <StoryFlow storylineId={activeStorylineId} />
          </>
        ) : (
          <div className="empty-state">
            <h2>Select or Create a Story and Storyline</h2>
            <p>Use the sidebar to navigate your stories and storylines.</p>
            {sidebarCollapsed && (
              <button onClick={toggleSidebar} className="create-btn">
                Open Sidebar
              </button>
            )}
          </div>
        )}
      </div>
      
      <style>{`
        .story-editor-container {
          display: flex;
          height: 100vh;
          width: 100%;
          position: relative;
        }
        
        .story-editor-sidebar {
          background-color: #f5f5f5;
          border-right: 1px solid #ddd;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
          transition: all 0.3s ease;
          position: relative;
          min-width: 250px;
          width: 250px;
          z-index: 10;
        }
        
        .story-editor-sidebar.collapsed {
          min-width: 30px;
          width: 30px;
          padding: 0;
          overflow: hidden;
        }
        
        .sidebar-toggle {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: #f5f5f5;
          border: 1px solid #ddd;
          border-right: none;
          width: 24px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          font-size: 12px;
          color: #555;
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
          z-index: 20;
        }
        
        .sidebar-toggle:hover {
          background: #e0e0e0;
        }
        
        .story-editor-content {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        
        .content-header {
          padding: 10px 15px;
          border-bottom: 1px solid #eee;
          background: #fdfdfd;
        }
        
        .content-header h1 {
          font-size: 18px;
          margin: 0;
          font-weight: 500;
          color: #333;
        }
        
        .sidebar-section h2 {
          margin-top: 0;
          margin-bottom: 10px;
          font-size: 16px;
        }
        
        .create-btn {
          width: 100%;
          padding: 8px;
          background-color: #2196f3;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 10px;
        }
        
        .create-btn:hover {
          background-color: #0b7dda;
        }
        
        .story-list, .storyline-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .story-list li, .storyline-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          margin-bottom: 4px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .story-list li:hover, .storyline-list li:hover {
          background-color: #e9e9e9;
        }
        
        .story-list li.active, .storyline-list li.active {
          background-color: #e3f2fd;
          border-left: 3px solid #2196f3;
        }
        
        .story-item, .storyline-item {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .story-title, .storyline-title {
          font-size: 14px;
        }
        
        .item-actions {
          display: flex;
          align-items: center;
        }
        
        .title-input {
          width: 90%;
          padding: 4px 6px;
          border: 1px solid #ccc;
          border-radius: 3px;
          font-size: 14px;
        }
        
        .edit-btn, .save-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          opacity: 0.7;
          transition: opacity 0.2s, background-color 0.2s;
          visibility: hidden;
        }
        
        .edit-btn {
          color: #2196f3;
        }
        
        .save-btn {
          color: #4caf50;
          font-weight: bold;
        }
        
        .story-list li:hover .edit-btn, .storyline-list li:hover .edit-btn {
          visibility: visible;
        }
        
        .save-btn {
          visibility: visible;
        }
        
        .edit-btn:hover {
          opacity: 1;
          background-color: rgba(33, 150, 243, 0.1);
        }
        
        .save-btn:hover {
          opacity: 1;
          background-color: rgba(76, 175, 80, 0.1);
        }
        
        .delete-btn {
          visibility: hidden;
          background: none;
          border: none;
          color: #f44336;
          cursor: pointer;
          padding: 2px 6px;
          margin-left: 8px;
          border-radius: 4px;
          opacity: 0.7;
          transition: opacity 0.2s, background-color 0.2s;
        }
        
        .story-list li:hover .delete-btn, .storyline-list li:hover .delete-btn {
          visibility: visible;
        }
        
        .delete-btn:hover {
          opacity: 1;
          background-color: rgba(244, 67, 54, 0.1);
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #666;
          text-align: center;
          padding: 20px;
        }
        
        .loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .loading-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error-message {
          background-color: #ffebee;
          color: #d32f2f;
          padding: 10px;
          margin: 10px;
          border-radius: 4px;
          border: 1px solid #ffcdd2;
        }
      `}</style>
    </div>
  );
};

export default StoryEditor; 