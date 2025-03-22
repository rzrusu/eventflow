// Event Model - represents individual story events
const EventSchema = {
  id: String,           // Unique identifier for the event
  title: String,        // Title of the event
  content: String,      // Main content/text of the event
  options: [            // Array of options for the player to choose from
    {
      text: String,     // Display text for the option
      nextEventId: String  // ID of the event this option leads to
    }
  ],
  links: [String]       // Array of IDs for events that are directly linked to this one
};

// Storyline Model - represents a sequence of connected events
const StorylineSchema = {
  id: String,           // Unique identifier for the storyline
  title: String,        // Title of the storyline
  description: String,  // Brief description about this storyline
  starterEventId: String, // ID of the event that starts this storyline
  events: [EventSchema]  // Array of events that make up this storyline
};

// Story Model - represents a complete story with multiple storylines
const StorySchema = {
  id: String,           // Unique identifier for the story
  title: String,        // Title of the story
  description: String,  // Brief description of the story
  author: String,       // Author of the story
  createdAt: Date,      // Creation date
  updatedAt: Date,      // Last update date
  published: Boolean,   // Whether the story is published
  storylines: [StorylineSchema] // Array of storylines that make up this story
};

module.exports = {
  EventSchema,
  StorylineSchema,
  StorySchema
}; 