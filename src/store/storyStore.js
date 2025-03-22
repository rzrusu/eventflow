import { create } from 'zustand';
import { storyDb, storylineDb, eventDb, initWithSampleData } from '../db/storyDb';

// Create a store with Zustand
const useStoryStore = create((set, get) => ({
  // State
  stories: [],
  storylines: [],
  activeStoryId: null,
  activeStorylineId: null,
  isLoading: false,
  error: null,
  
  // Story operations
  loadStories: async () => {
    set({ isLoading: true, error: null });
    try {
      const stories = await storyDb.getAll();
      set({ stories, isLoading: false });
    } catch (error) {
      console.error('Failed to load stories', error);
      set({ error: 'Failed to load stories', isLoading: false });
    }
  },
  
  createStory: async (storyData) => {
    set({ isLoading: true, error: null });
    try {
      const storyId = `story-${Date.now()}`;
      const newStory = {
        id: storyId,
        title: storyData.title || `New Story ${get().stories.length + 1}`,
        description: storyData.description || 'Add a description',
        author: storyData.author || 'Anonymous',
        published: false
      };
      
      await storyDb.add(newStory);
      
      set(state => ({ 
        stories: [...state.stories, newStory],
        activeStoryId: storyId,
        isLoading: false 
      }));
      
      return storyId;
    } catch (error) {
      console.error('Failed to create story', error);
      set({ error: 'Failed to create story', isLoading: false });
      return null;
    }
  },
  
  updateStory: async (storyId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const story = await storyDb.getById(storyId);
      const updatedStory = { ...story, ...updates };
      
      await storyDb.update(updatedStory);
      
      set(state => ({
        stories: state.stories.map(s => s.id === storyId ? updatedStory : s),
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to update story', error);
      set({ error: 'Failed to update story', isLoading: false });
    }
  },
  
  deleteStory: async (storyId) => {
    set({ isLoading: true, error: null });
    try {
      // Get all storylines for this story
      const storylines = await storylineDb.getByStoryId(storyId);
      
      // Delete all events for each storyline
      for (const storyline of storylines) {
        await eventDb.deleteByStorylineId(storyline.id);
        await storylineDb.delete(storyline.id);
      }
      
      // Delete the story
      await storyDb.delete(storyId);
      
      set(state => ({
        stories: state.stories.filter(s => s.id !== storyId),
        activeStoryId: state.activeStoryId === storyId ? null : state.activeStoryId,
        activeStorylineId: storylines.some(sl => sl.id === state.activeStorylineId) ? null : state.activeStorylineId,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to delete story', error);
      set({ error: 'Failed to delete story', isLoading: false });
    }
  },
  
  setActiveStory: (storyId) => {
    set({ activeStoryId: storyId, activeStorylineId: null });
  },
  
  // Storyline operations
  loadStorylines: async (storyId) => {
    set({ isLoading: true, error: null });
    
    if (!storyId) {
      set({ storylines: [], isLoading: false });
      return [];
    }
    
    try {
      const storylines = await storylineDb.getByStoryId(storyId);
      set({ storylines, isLoading: false });
      return storylines;
    } catch (error) {
      console.error('Failed to load storylines', error);
      set({ error: 'Failed to load storylines', isLoading: false });
      return [];
    }
  },
  
  createStoryline: async (storyId, storylineData) => {
    set({ isLoading: true, error: null });
    
    if (!storyId) {
      set({ error: 'No active story selected', isLoading: false });
      return null;
    }
    
    try {
      const storylines = await storylineDb.getByStoryId(storyId);
      const storylineId = `storyline-${Date.now()}`;
      
      const newStoryline = {
        id: storylineId,
        storyId,
        title: storylineData?.title || `New Storyline ${storylines.length + 1}`,
        description: storylineData?.description || 'Add a description',
        starterEventId: null
      };
      
      await storylineDb.add(newStoryline);
      
      set({ 
        activeStorylineId: storylineId,
        isLoading: false 
      });
      
      return storylineId;
    } catch (error) {
      console.error('Failed to create storyline', error);
      set({ error: 'Failed to create storyline', isLoading: false });
      return null;
    }
  },
  
  updateStoryline: async (storylineId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const storyline = await storylineDb.getById(storylineId);
      const updatedStoryline = { ...storyline, ...updates };
      
      await storylineDb.update(updatedStoryline);
      set({ isLoading: false });
      
      return updatedStoryline;
    } catch (error) {
      console.error('Failed to update storyline', error);
      set({ error: 'Failed to update storyline', isLoading: false });
      return null;
    }
  },
  
  deleteStoryline: async (storylineId) => {
    set({ isLoading: true, error: null });
    try {
      // Delete all events in this storyline
      await eventDb.deleteByStorylineId(storylineId);
      
      // Delete the storyline
      await storylineDb.delete(storylineId);
      
      set(state => ({
        activeStorylineId: state.activeStorylineId === storylineId ? null : state.activeStorylineId,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to delete storyline', error);
      set({ error: 'Failed to delete storyline', isLoading: false });
    }
  },
  
  setActiveStoryline: (storylineId) => {
    set({ activeStorylineId: storylineId });
  },
  
  // Event operations
  loadEvents: async (storylineId) => {
    set({ isLoading: true, error: null });
    
    if (!storylineId) {
      set({ events: [], isLoading: false });
      return [];
    }
    
    try {
      const events = await eventDb.getByStorylineId(storylineId);
      set({ events, isLoading: false });
      return events;
    } catch (error) {
      console.error('Failed to load events', error);
      set({ error: 'Failed to load events', isLoading: false });
      return [];
    }
  },
  
  createEvent: async (storylineId, eventData) => {
    set({ isLoading: true, error: null });
    try {
      const events = await eventDb.getByStorylineId(storylineId);
      const eventId = `event-${Date.now()}`;
      
      const newEvent = {
        id: eventId,
        storylineId,
        title: eventData?.title || `Event ${events.length + 1}`,
        content: eventData?.content || 'Add content here...',
        options: eventData?.options || [],
        links: eventData?.links || [],
        position: eventData?.position || { x: 0, y: 0 },
        isStarter: events.length === 0 // First event is starter by default
      };
      
      await eventDb.add(newEvent);
      
      // If this is the first event, update the storyline's starterEventId
      if (events.length === 0) {
        const storyline = await storylineDb.getById(storylineId);
        storyline.starterEventId = eventId;
        await storylineDb.update(storyline);
      }
      
      set({ isLoading: false });
      
      return eventId;
    } catch (error) {
      console.error('Failed to create event', error);
      set({ error: 'Failed to create event', isLoading: false });
      return null;
    }
  },
  
  updateEvent: async (eventId, updates) => {
    set({ isLoading: true, error: null });
    try {
      const event = await eventDb.getById(eventId);
      const updatedEvent = { ...event, ...updates };
      
      await eventDb.update(updatedEvent);
      set({ isLoading: false });
      
      // If this is the starter event and we're updating position,
      // we need to return the updated event
      return updatedEvent;
    } catch (error) {
      console.error('Failed to update event', error);
      set({ error: 'Failed to update event', isLoading: false });
      return null;
    }
  },
  
  deleteEvent: async (eventId) => {
    set({ isLoading: true, error: null });
    try {
      const event = await eventDb.getById(eventId);
      
      // Check if this is the starter event
      if (event.isStarter) {
        const storyline = await storylineDb.getById(event.storylineId);
        if (storyline.starterEventId === eventId) {
          storyline.starterEventId = null;
          await storylineDb.update(storyline);
        }
      }
      
      // Update links in other events that point to this event
      const events = await eventDb.getByStorylineId(event.storylineId);
      for (const otherEvent of events) {
        if (otherEvent.id !== eventId) {
          // Remove from links array
          if (otherEvent.links.includes(eventId)) {
            otherEvent.links = otherEvent.links.filter(id => id !== eventId);
            
            // Remove from options that point to this event
            if (otherEvent.options && otherEvent.options.length > 0) {
              otherEvent.options = otherEvent.options.map(option => {
                if (option.nextEventId === eventId) {
                  return { ...option, nextEventId: null };
                }
                return option;
              });
            }
            
            await eventDb.update(otherEvent);
          }
        }
      }
      
      // Delete the event
      await eventDb.delete(eventId);
      set({ isLoading: false });
    } catch (error) {
      console.error('Failed to delete event', error);
      set({ error: 'Failed to delete event', isLoading: false });
    }
  },
  
  setEventAsStarter: async (eventId, storylineId) => {
    set({ isLoading: true, error: null });
    try {
      // Get all events in the storyline
      const events = await eventDb.getByStorylineId(storylineId);
      
      // Update the events to reflect the new starter
      for (const event of events) {
        if (event.id === eventId) {
          await eventDb.update({ ...event, isStarter: true });
        } else if (event.isStarter) {
          await eventDb.update({ ...event, isStarter: false });
        }
      }
      
      // Update the storyline
      const storyline = await storylineDb.getById(storylineId);
      storyline.starterEventId = eventId;
      await storylineDb.update(storyline);
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Failed to set starter event', error);
      set({ error: 'Failed to set starter event', isLoading: false });
    }
  },
  
  addEdge: async (sourceId, targetId) => {
    set({ isLoading: true, error: null });
    try {
      const sourceEvent = await eventDb.getById(sourceId);
      
      // Add target to links if not already present
      if (!sourceEvent.links.includes(targetId)) {
        sourceEvent.links.push(targetId);
        await eventDb.update(sourceEvent);
      }
      
      set({ isLoading: false });
    } catch (error) {
      console.error('Failed to add edge', error);
      set({ error: 'Failed to add edge', isLoading: false });
    }
  },
  
  removeEdge: async (sourceId, targetId) => {
    set({ isLoading: true, error: null });
    try {
      const sourceEvent = await eventDb.getById(sourceId);
      
      // Remove target from links
      sourceEvent.links = sourceEvent.links.filter(id => id !== targetId);
      
      // Remove from options that point to this event
      if (sourceEvent.options && sourceEvent.options.length > 0) {
        sourceEvent.options = sourceEvent.options.map(option => {
          if (option.nextEventId === targetId) {
            return { ...option, nextEventId: null };
          }
          return option;
        });
      }
      
      await eventDb.update(sourceEvent);
      set({ isLoading: false });
    } catch (error) {
      console.error('Failed to remove edge', error);
      set({ error: 'Failed to remove edge', isLoading: false });
    }
  },
  
  // Sample data initialization
  initializeSampleData: async () => {
    try {
      set({ isLoading: true });
      await initWithSampleData();
      // After initializing, reload stories to update the state
      const stories = await storyDb.getAll();
      set({ stories, isLoading: false });
    } catch (error) {
      console.error('Failed to initialize sample data', error);
      set({ error: 'Failed to initialize sample data', isLoading: false });
    }
  }
}));

export default useStoryStore; 