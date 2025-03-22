import React, { useState, useEffect } from 'react';
import StoryFlow from '../components/StoryFlow';
import useStoryStore from '../src/store/storyStore';
import '../styles/StoryFlow.css';

const StoryEditor = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
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
  
  // Get active storyline title
  const getActiveStorylineTitle = () => {
    const storyline = getActiveStoryline();
    return storyline ? storyline.title : 'Select a Storyline';
  };

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
                    onClick={() => handleStoryClick(story.id)}
                  >
                    {story.title}
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
                        onClick={() => setActiveStoryline(storyline.id)}
                      >
                        {storyline.title}
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
          padding: 8px 10px;
          margin-bottom: 5px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .story-list li:hover, .storyline-list li:hover {
          background-color: #e0e0e0;
        }
        
        .story-list li.active, .storyline-list li.active {
          background-color: #e3f2fd;
          font-weight: bold;
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