import React, { useState } from 'react';
import StoryFlow from '../components/StoryFlow';
import '../styles/StoryFlow.css';

const StoryEditor = () => {
  const [activeStory, setActiveStory] = useState(null);
  const [activeStoryline, setActiveStoryline] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Example story data - in a real app, this would come from your backend
  const [stories, setStories] = useState([
    {
      id: 'story-1',
      title: 'My First Story',
      description: 'An adventure through time',
      storylines: [
        {
          id: 'storyline-1',
          title: 'Main Path',
          description: 'The primary storyline'
        },
        {
          id: 'storyline-2',
          title: 'Secret Ending',
          description: 'An alternative storyline'
        }
      ]
    }
  ]);
  
  // Create a new story
  const createNewStory = () => {
    const newStory = {
      id: `story-${stories.length + 1}`,
      title: `New Story ${stories.length + 1}`,
      description: 'Add a description',
      storylines: []
    };
    
    setStories([...stories, newStory]);
    setActiveStory(newStory.id);
    setActiveStoryline(null);
  };
  
  // Create a new storyline in the active story
  const createNewStoryline = () => {
    if (!activeStory) return;
    
    const updatedStories = stories.map(story => {
      if (story.id === activeStory) {
        const newStoryline = {
          id: `storyline-${story.storylines.length + 1}-${Date.now()}`,
          title: `New Storyline ${story.storylines.length + 1}`,
          description: 'Add a description'
        };
        
        return {
          ...story,
          storylines: [...story.storylines, newStoryline]
        };
      }
      return story;
    });
    
    setStories(updatedStories);
    
    // Find the newly created storyline and set it as active
    const currentStory = updatedStories.find(s => s.id === activeStory);
    if (currentStory && currentStory.storylines.length > 0) {
      setActiveStoryline(currentStory.storylines[currentStory.storylines.length - 1].id);
    }
  };
  
  // Get the active storyline object
  const getActiveStorylineObject = () => {
    if (!activeStory || !activeStoryline) return null;
    
    const story = stories.find(s => s.id === activeStory);
    if (!story) return null;
    
    return story.storylines.find(sl => sl.id === activeStoryline);
  };

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <div className="story-editor-container">
      {/* Collapsible Sidebar */}
      <div className={`story-editor-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <>
            <div className="sidebar-section">
              <h2>Stories</h2>
              <button onClick={createNewStory} className="create-btn">+ New Story</button>
              <ul className="story-list">
                {stories.map(story => (
                  <li 
                    key={story.id} 
                    className={activeStory === story.id ? 'active' : ''}
                    onClick={() => setActiveStory(story.id)}
                  >
                    {story.title}
                  </li>
                ))}
              </ul>
            </div>
            
            {activeStory && (
              <div className="sidebar-section">
                <h2>Storylines</h2>
                <button onClick={createNewStoryline} className="create-btn">+ New Storyline</button>
                <ul className="storyline-list">
                  {stories
                    .find(s => s.id === activeStory)
                    ?.storylines.map(storyline => (
                      <li 
                        key={storyline.id} 
                        className={activeStoryline === storyline.id ? 'active' : ''}
                        onClick={() => setActiveStoryline(storyline.id)}
                      >
                        {storyline.title}
                      </li>
                    ))
                  }
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
        {activeStory && activeStoryline ? (
          <>
            <div className="content-header">
              <h1>{getActiveStorylineObject()?.title || 'Select a Storyline'}</h1>
            </div>
            <StoryFlow storylineId={activeStoryline} />
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
      
      <style jsx>{`
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
      `}</style>
    </div>
  );
};

export default StoryEditor; 