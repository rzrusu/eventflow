import { openDB } from 'idb';

// Define database name and version
const DB_NAME = 'eventflow_db';
const DB_VERSION = 1;

// Define store names (tables)
const STORES = {
  STORIES: 'stories',
  STORYLINES: 'storylines',
  EVENTS: 'events'
};

// Initialize database
export const initDB = async () => {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.STORIES)) {
        const storyStore = db.createObjectStore(STORES.STORIES, { keyPath: 'id' });
        storyStore.createIndex('title', 'title', { unique: false });
        storyStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.STORYLINES)) {
        const storylineStore = db.createObjectStore(STORES.STORYLINES, { keyPath: 'id' });
        storylineStore.createIndex('storyId', 'storyId', { unique: false });
        storylineStore.createIndex('title', 'title', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.EVENTS)) {
        const eventStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
        eventStore.createIndex('storylineId', 'storylineId', { unique: false });
        eventStore.createIndex('title', 'title', { unique: false });
      }
    }
  });

  return db;
};

// DB operations for Stories
export const storyDb = {
  // Get all stories
  async getAll() {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.getAll(STORES.STORIES);
  },

  // Get a story by id
  async getById(id) {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.get(STORES.STORIES, id);
  },

  // Add a new story
  async add(story) {
    const db = await openDB(DB_NAME, DB_VERSION);
    story.createdAt = new Date();
    story.updatedAt = new Date();
    return db.add(STORES.STORIES, story);
  },

  // Update an existing story
  async update(story) {
    const db = await openDB(DB_NAME, DB_VERSION);
    story.updatedAt = new Date();
    return db.put(STORES.STORIES, story);
  },

  // Delete a story
  async delete(id) {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.delete(STORES.STORIES, id);
  }
};

// DB operations for Storylines
export const storylineDb = {
  // Get all storylines
  async getAll() {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.getAll(STORES.STORYLINES);
  },

  // Get storylines by story id
  async getByStoryId(storyId) {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORES.STORYLINES, 'readonly');
    const index = tx.store.index('storyId');
    return index.getAll(storyId);
  },

  // Get a storyline by id
  async getById(id) {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.get(STORES.STORYLINES, id);
  },

  // Add a new storyline
  async add(storyline) {
    const db = await openDB(DB_NAME, DB_VERSION);
    storyline.createdAt = new Date();
    storyline.updatedAt = new Date();
    return db.add(STORES.STORYLINES, storyline);
  },

  // Update an existing storyline
  async update(storyline) {
    const db = await openDB(DB_NAME, DB_VERSION);
    storyline.updatedAt = new Date();
    return db.put(STORES.STORYLINES, storyline);
  },

  // Delete a storyline
  async delete(id) {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.delete(STORES.STORYLINES, id);
  }
};

// DB operations for Events
export const eventDb = {
  // Get all events
  async getAll() {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.getAll(STORES.EVENTS);
  },

  // Get events by storyline id
  async getByStorylineId(storylineId) {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORES.EVENTS, 'readonly');
    const index = tx.store.index('storylineId');
    return index.getAll(storylineId);
  },

  // Get an event by id
  async getById(id) {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.get(STORES.EVENTS, id);
  },

  // Add a new event
  async add(event) {
    const db = await openDB(DB_NAME, DB_VERSION);
    event.createdAt = new Date();
    event.updatedAt = new Date();
    return db.add(STORES.EVENTS, event);
  },

  // Update an existing event
  async update(event) {
    const db = await openDB(DB_NAME, DB_VERSION);
    event.updatedAt = new Date();
    return db.put(STORES.EVENTS, event);
  },

  // Delete an event
  async delete(id) {
    const db = await openDB(DB_NAME, DB_VERSION);
    return db.delete(STORES.EVENTS, id);
  },

  // Delete all events in a storyline
  async deleteByStorylineId(storylineId) {
    const db = await openDB(DB_NAME, DB_VERSION);
    const tx = db.transaction(STORES.EVENTS, 'readwrite');
    const index = tx.store.index('storylineId');
    const events = await index.getAll(storylineId);
    
    for (const event of events) {
      await tx.store.delete(event.id);
    }
    
    await tx.done;
    return events.length;
  }
};

// Create a method to initialize with sample data (for testing/development)
export const initWithSampleData = async () => {
  // Check if we already have data
  const stories = await storyDb.getAll();
  if (stories.length > 0) return; // Skip if data exists

  try {
    // Sample story
    const storyId = `story-${Date.now()}`;
    await storyDb.add({
      id: storyId,
      title: 'Adventure in Wonderland',
      description: 'An exciting journey through a magical world',
      author: 'Sample Author',
      published: false
    });

    // Sample storylines
    const storyline1Id = `storyline-${Date.now()}-1`;
    const storyline2Id = `storyline-${Date.now()}-2`;
    
    await storylineDb.add({
      id: storyline1Id,
      storyId: storyId,
      title: 'Main Path',
      description: 'The primary storyline',
      starterEventId: null
    });

    await storylineDb.add({
      id: storyline2Id,
      storyId: storyId,
      title: 'Secret Ending',
      description: 'An alternative secret ending',
      starterEventId: null
    });

    // Small delay to ensure unique timestamps for event IDs
    await new Promise(resolve => setTimeout(resolve, 5));
    
    // Sample events for the first storyline
    const event1Id = `event-${Date.now()}-1`;
    
    // Another small delay for unique IDs
    await new Promise(resolve => setTimeout(resolve, 5));
    const event2Id = `event-${Date.now()}-2`;
    
    // Another small delay for unique IDs
    await new Promise(resolve => setTimeout(resolve, 5));
    const event3Id = `event-${Date.now()}-3`;

    await eventDb.add({
      id: event1Id,
      storylineId: storyline1Id,
      title: 'The Beginning',
      content: 'You find yourself at the entrance to a mysterious forest...',
      options: [
        { text: 'Enter the forest', nextEventId: event2Id },
        { text: 'Turn back', nextEventId: event3Id }
      ],
      links: [event2Id, event3Id],
      position: { x: 150, y: 100 }
    });

    await eventDb.add({
      id: event2Id,
      storylineId: storyline1Id,
      title: 'Into the Woods',
      content: 'The forest is dark and full of strange sounds...',
      options: [],
      links: [],
      position: { x: 450, y: 50 }
    });

    await eventDb.add({
      id: event3Id,
      storylineId: storyline1Id,
      title: 'Return Home',
      content: 'You decide that adventure is not for you today...',
      options: [],
      links: [],
      position: { x: 450, y: 200 }
    });

    // Update the storyline with the starter event
    const storyline1 = await storylineDb.getById(storyline1Id);
    storyline1.starterEventId = event1Id;
    await storylineDb.update(storyline1);
  } catch (error) {
    console.error('Error initializing sample data', error);
  }
};

// Initialize the database when this module is imported
initDB().catch(error => {
  console.error('Failed to initialize the database', error);
}); 