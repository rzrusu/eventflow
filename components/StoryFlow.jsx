import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useStoryStore from '../src/store/storyStore';
import EventEditor from './EventEditor';

// Custom node for an event
const EventNode = ({ data }) => {
  // Helper function to find connected event title
  const getConnectedEventTitle = (eventId) => {
    if (!eventId || !data.allEvents) return 'Unknown Event';
    const connectedEvent = data.allEvents.find(event => event.id === eventId);
    return connectedEvent ? connectedEvent.title : 'Unknown Event';
  };
  
  return (
    <div className={`event-node ${data.isStarter ? 'starter-event' : ''}`}>
      {/* Input handle on the left side of the node */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="target" 
        className="event-handle event-input-handle"
      />
      
      <div className="event-node-header">
        <strong>{data.title || 'New Event'}</strong>
        {data.isStarter && <span className="starter-badge">Starter</span>}
      </div>
      <div className="event-node-content">
        <p>{data.content || 'Event content...'}</p>
      </div>
      <div className="event-node-options">
        {data.options && data.options.map((option, index) => (
          <div 
            key={index} 
            className={`event-option ${option.nextEventId ? 'has-connection' : ''}`}
            title={option.nextEventId ? `Connected to: ${getConnectedEventTitle(option.nextEventId)}` : 'Drag to connect'}
          >
            <div className="option-text">{option.text}</div>
            {option.nextEventId && <span className="option-connection-indicator">→</span>}
            
            {/* Output handle for each option */}
            <Handle
              type="source"
              position={Position.Right}
              id={`option-${index}`}
              className="event-handle option-handle"
              style={{ top: `${(index * 30) + 15}px` }}
            />
          </div>
        ))}
      </div>
      
      {/* Removed the default output handle that was at the bottom */}
    </div>
  );
};

// Node types registration
const nodeTypes = {
  event: EventNode,
};

const StoryFlow = ({ storylineId }) => {
  // Initialize with empty nodes and edges
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Track the selected node
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Toggle for control panel visibility
  const [showControls, setShowControls] = useState(false);
  
  // Track the node being edited
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [editingNodeData, setEditingNodeData] = useState(null);
  
  // Store all events for the current storyline
  const [allEvents, setAllEvents] = useState([]);
  
  // Get state and actions from the store
  const {
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    setEventAsStarter,
    addEdge: addDbEdge,
    removeEdge: removeDbEdge
  } = useStoryStore();

  // Reference to the file input element for importing
  const fileInputRef = useRef(null);

  // Load events from the database when storyline changes
  useEffect(() => {
    const fetchEvents = async () => {
      if (!storylineId) return;
      
      try {
        // Get events from the database
        const dbEvents = await loadEvents(storylineId);
        
        // Convert any events with old-format options if needed
        for (const event of dbEvents) {
          if (event.options) {
            // Check if the options array contains string values directly
            const needsConversion = event.options.some(opt => typeof opt === 'string');
            
            if (needsConversion) {
              // Convert old format (array of strings) to new format (array of objects)
              const newOptions = event.options.map((opt, index) => {
                if (typeof opt === 'string') {
                  return {
                    text: opt,
                    nextEventId: event.links && event.links[index] ? event.links[index] : null
                  };
                }
                return opt;
              });
              
              // Update the event with the new options format
              await updateEvent(event.id, { options: newOptions });
            }
          }
        }
        
        // Get the fresh data after potential updates
        const updatedEvents = await loadEvents(storylineId);
        setAllEvents(updatedEvents);
        
        // Convert events to ReactFlow nodes
        const flowNodes = updatedEvents.map(event => ({
          id: event.id,
          type: 'event',
          position: event.position || { x: 0, y: 0 },
          data: {
            ...event,
            isStarter: !!event.isStarter,
            allEvents: updatedEvents
          }
        }));
        
        // Create edges from options
        const flowEdges = [];
        
        updatedEvents.forEach(event => {
          // Add edges from options
          if (event.options && event.options.length > 0) {
            event.options.forEach((option, index) => {
              if (option.nextEventId) {
                flowEdges.push({
                  id: `edge-option-${event.id}-${option.nextEventId}-${index}`,
                  source: event.id,
                  target: option.nextEventId,
                  sourceHandle: `option-${index}`,
                  targetHandle: 'target',
                  type: 'smoothstep',
                  animated: true,
                  style: { stroke: '#2196f3' },
                  markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: '#2196f3'
                  },
                  data: { 
                    optionText: option.text,
                    optionIndex: index 
                  }
                });
              }
            });
          }
        });
        
        setNodes(flowNodes);
        setEdges(flowEdges);
        setSelectedNode(null);
      } catch (error) {
        console.error('Error loading events for storyline', error);
      }
    };
    
    fetchEvents();
  }, [storylineId, loadEvents, setNodes, setEdges, updateEvent]);

  // Handle connections between nodes
  const onConnect = useCallback(async (params) => {
    console.log('Connection params:', params);
    
    // All connections now come from option handles since we removed the bottom handle
    const isOptionConnection = params.sourceHandle && params.sourceHandle.startsWith('option-');
    
    if (isOptionConnection) {
      const optionIndex = parseInt(params.sourceHandle.split('-')[1], 10);
      const sourceNode = nodes.find(n => n.id === params.source);
      
      if (sourceNode && sourceNode.data.options && sourceNode.data.options[optionIndex]) {
        // Update the option's nextEventId
        const updatedOptions = [...sourceNode.data.options];
        updatedOptions[optionIndex] = {
          ...updatedOptions[optionIndex],
          nextEventId: params.target
        };
        
        // Collect all nextEventIds for the links array
        const links = updatedOptions
          .map(opt => opt.nextEventId)
          .filter(id => id !== null && id !== undefined);
          
        // Update the event in the database
        await updateEvent(params.source, { 
          options: updatedOptions,
          links
        });
        
        // Create a visual edge
        const edge = {
          id: `edge-option-${params.source}-${params.target}-${optionIndex}`,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle,
          targetHandle: params.targetHandle || 'target',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#2196f3' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#2196f3'
          },
          data: { 
            optionText: updatedOptions[optionIndex].text,
            optionIndex 
          }
        };
        
        setEdges(eds => addEdge(edge, eds));
      }
    } else {
      // If we get here, it's a non-option connection (which shouldn't happen with our new design)
      // But we'll keep this as a fallback just in case
      console.warn('Unexpected connection type', params);
    }
  }, [nodes, setEdges, updateEvent]);
  
  // Handle node drag
  const onNodeDragStop = useCallback(async (event, node) => {
    // Update the node position in the database
    await updateEvent(node.id, { position: node.position });
  }, [updateEvent]);
  
  // Handle node selection
  const onNodeClick = (event, node) => {
    setSelectedNode(node.id);
  };
  
  // Handle node double-click to edit
  const onNodeDoubleClick = (event, node) => {
    setEditingNodeId(node.id);
    setEditingNodeData(node.data);
  };
  
  // Handle click on canvas to deselect node
  const onPaneClick = () => {
    setSelectedNode(null);
  };
  
  // Handle edge removal
  const onEdgeDelete = async (edge) => {
    // All edges are now option edges
    if (edge.id.startsWith('edge-option')) {
      // Find the source node and option index
      const [_, __, sourceId, targetId, optionIndex] = edge.id.split('-');
      const sourceNode = nodes.find(n => n.id === sourceId);
      if (sourceNode && sourceNode.data.options && sourceNode.data.options[optionIndex]) {
        // Remove the option connection
        const updatedOptions = [...sourceNode.data.options];
        updatedOptions[optionIndex] = {
          ...updatedOptions[optionIndex],
          nextEventId: null
        };
        
        // Update the node
        await updateEvent(sourceId, { 
          options: updatedOptions,
          links: updatedOptions
            .map(opt => opt.nextEventId)
            .filter(id => id !== null && id !== undefined)
        });
      }
    } else {
      console.warn('Unknown edge type:', edge.id);
    }
  };

  // Create a new event node
  const createEventNode = async () => {
    if (!storylineId) return;
    
    // Calculate position for new node
    // Position nodes in a grid-like pattern
    const nodesPerRow = 3;
    const nodesCount = nodes.length;
    const xPosition = 150 + ((nodesCount % nodesPerRow) * 300);
    const yPosition = 100 + (Math.floor(nodesCount / nodesPerRow) * 200);
    
    const position = { x: xPosition, y: yPosition };
    
    // Create the event in the database
    const newEventId = await createEvent(storylineId, {
      title: `Event ${nodesCount + 1}`,
      content: 'Double-click to edit this event',
      position,
      options: [],
      links: []
    });
    
    if (newEventId) {
      // Reload events to get the updated list with the new event
      const dbEvents = await loadEvents(storylineId);
      setAllEvents(dbEvents);
      
      // Find our new event
      const newEvent = dbEvents.find(e => e.id === newEventId);
      
      if (newEvent) {
        // Add the new node to the flow
        const newNode = {
          id: newEventId,
          type: 'event',
          position,
          data: {
            ...newEvent,
            isStarter: !!newEvent.isStarter,
            allEvents: dbEvents
          }
        };
        
        setNodes((nds) => [...nds, newNode]);
        
        // Select and start editing the new node
        setSelectedNode(newEventId);
        setEditingNodeId(newEventId);
        setEditingNodeData(newNode.data);
      }
    }
  };

  // Set an event as the starting event for the current storyline
  const setAsStarterEvent = async () => {
    if (!selectedNode || !storylineId) return;
    
    await setEventAsStarter(selectedNode, storylineId);
    
    // Update the nodes to reflect the new starter
    setNodes(nodes.map(node => {
      if (node.id === selectedNode) {
        return {
          ...node,
          data: {
            ...node.data,
            isStarter: true
          }
        };
      } else if (node.data.isStarter) {
        return {
          ...node,
          data: {
            ...node.data,
            isStarter: false
          }
        };
      }
      return node;
    }));
  };

  // Add a new option to the selected event
  const addOptionToEvent = async () => {
    if (!selectedNode) return;
    
    // Find the node
    const node = nodes.find(n => n.id === selectedNode);
    if (!node) return;
    
    // Create a new option
    const options = [...(node.data.options || [])];
    options.push({
      text: `Option ${options.length + 1}`,
      nextEventId: null
    });
    
    // Update the event in the database
    await updateEvent(selectedNode, { options });
    
    // Update the node in the flow
    setNodes(nodes.map(n => {
      if (n.id === selectedNode) {
        const updatedData = {
          ...n.data,
          options
        };
        return {
          ...n,
          data: updatedData
        };
      }
      return n;
    }));
  };

  // Delete the selected node
  const deleteSelectedNode = async () => {
    if (!selectedNode) return;
    
    // Delete the event from the database
    await deleteEvent(selectedNode);
    
    // Remove the node from the flow
    setNodes(nodes.filter(node => node.id !== selectedNode));
    
    // Remove any edges connected to this node
    setEdges(edges.filter(edge => 
      edge.source !== selectedNode && edge.target !== selectedNode
    ));
    
    setSelectedNode(null);
  };
  
  // Handle event editor close
  const handleEventEditorClose = async () => {
    setEditingNodeId(null);
    setEditingNodeData(null);
    
    // Reload events to get the updated data
    if (storylineId) {
      const dbEvents = await loadEvents(storylineId);
      setAllEvents(dbEvents);
      
      // Update the nodes with fresh data
      setNodes(prevNodes => 
        prevNodes.map(node => {
          const updatedEvent = dbEvents.find(e => e.id === node.id);
          if (updatedEvent) {
            return {
              ...node,
              data: {
                ...updatedEvent,
                isStarter: !!updatedEvent.isStarter,
                allEvents: dbEvents  // Update allEvents for each node
              }
            };
          }
          return node;
        })
      );
      
      // Rebuild edges - only from options now, since we removed the bottom source handle
      const newEdges = [];
      
      dbEvents.forEach(event => {
        // Add edges from options
        if (event.options && event.options.length > 0) {
          event.options.forEach((option, index) => {
            if (option.nextEventId) {
              newEdges.push({
                id: `edge-option-${event.id}-${option.nextEventId}-${index}`,
                source: event.id,
                target: option.nextEventId,
                sourceHandle: `option-${index}`,
                targetHandle: 'target',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#2196f3' },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: '#2196f3'
                },
                data: { 
                  optionText: option.text,
                  optionIndex: index 
                }
              });
            }
          });
        }
      });
      
      setEdges(newEdges);
    }
  };

  // Edit event button handler
  const handleEditEvent = () => {
    if (!selectedNode) return;
    
    // Find the node
    const node = nodes.find(n => n.id === selectedNode);
    if (!node) return;
    
    setEditingNodeId(node.id);
    setEditingNodeData(node.data);
  };

  // Export storyline to JSON
  const exportToJson = () => {
    if (!storylineId || !allEvents || allEvents.length === 0) {
      alert('No events to export');
      return;
    }
    
    try {
      // Create a deep copy of the events to avoid modifying the original data
      const eventsToExport = JSON.parse(JSON.stringify(allEvents));
      
      // Get the current node positions from the flow
      const nodePositions = {};
      nodes.forEach(node => {
        nodePositions[node.id] = node.position;
      });
      
      // Format the data for export with the new simplified format
      const formattedEvents = eventsToExport.map(event => {
        // Keep all the important fields
        const { 
          id, 
          title, 
          content, 
          options, 
          isStarter, 
          storylineId
        } = event;
        
        // Use the current position from the flow
        const position = nodePositions[id] || event.position || { x: 0, y: 0 };
        
        // Convert options to simple text array and create corresponding links array
        const optionTexts = [];
        const optionLinks = [];
        
        if (options && options.length > 0) {
          options.forEach(option => {
            // Add the option text to the options array
            optionTexts.push(option.text);
            
            // Add the corresponding nextEventId to the links array (null if not connected)
            optionLinks.push(option.nextEventId || null);
          });
        }
        
        return {
          id,
          title,
          content,
          options: optionTexts,
          links: optionLinks,
          isStarter: !!isStarter,
          storylineId,
          position
        };
      });
      
      // Create a Blob with the JSON data
      const jsonString = JSON.stringify(formattedEvents, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyline-${storylineId}.json`;
      
      // Trigger the download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Storyline exported successfully');
    } catch (error) {
      console.error('Error exporting storyline:', error);
      alert('Error exporting storyline. Check console for details.');
    }
  };

  // Import storyline from JSON
  const importFromJson = async (event) => {
    if (!storylineId) {
      alert('Please select a storyline first');
      return;
    }
    
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // Read the file
      const fileContent = await file.text();
      const importedEvents = JSON.parse(fileContent);
      
      if (!Array.isArray(importedEvents) || importedEvents.length === 0) {
        throw new Error('Invalid file format. Expected an array of events.');
      }
      
      // Ask for confirmation before importing
      if (!window.confirm(`Import ${importedEvents.length} events? This will replace your current events in this storyline.`)) {
        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Delete all existing events in this storyline
      const existingEvents = await loadEvents(storylineId);
      for (const event of existingEvents) {
        await deleteEvent(event.id);
      }
      
      // Import all events
      for (const event of importedEvents) {
        // Make sure each event belongs to the current storyline
        const eventToImport = {
          ...event,
          storylineId
        };
        
        // Convert the simplified options/links format to the internal format
        if (Array.isArray(event.options) && Array.isArray(event.links)) {
          // Create option objects with text and nextEventId properties
          const formattedOptions = event.options.map((text, index) => ({
            text,
            nextEventId: event.links[index] || null
          }));
          
          eventToImport.options = formattedOptions;
        } else if (Array.isArray(event.options)) {
          // Handle case where we have options but no links
          eventToImport.options = event.options.map(opt => {
            // Check if opt is already in the complex format
            if (typeof opt === 'object' && opt.text) {
              return opt;
            }
            return { text: opt, nextEventId: null };
          });
        }
        
        // Create the event in the database
        await createEvent(storylineId, eventToImport);
      }
      
      // Reload the events
      const dbEvents = await loadEvents(storylineId);
      setAllEvents(dbEvents);
      
      // Update the nodes with fresh data
      const flowNodes = dbEvents.map(event => ({
        id: event.id,
        type: 'event',
        position: event.position || { x: 0, y: 0 },
        data: {
          ...event,
          isStarter: !!event.isStarter,
          allEvents: dbEvents
        }
      }));
      
      // Create edges from options
      const flowEdges = [];
      
      dbEvents.forEach(event => {
        // Add edges from options
        if (event.options && event.options.length > 0) {
          event.options.forEach((option, index) => {
            if (option.nextEventId) {
              flowEdges.push({
                id: `edge-option-${event.id}-${option.nextEventId}-${index}`,
                source: event.id,
                target: option.nextEventId,
                sourceHandle: `option-${index}`,
                targetHandle: 'target',
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#2196f3' },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: '#2196f3'
                },
                data: { 
                  optionText: option.text,
                  optionIndex: index 
                }
              });
            }
          });
        }
      });
      
      setNodes(flowNodes);
      setEdges(flowEdges);
      setSelectedNode(null);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      alert('Storyline imported successfully!');
    } catch (error) {
      console.error('Error importing storyline:', error);
      alert(`Error importing storyline: ${error.message}`);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // Trigger file input click
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="story-flow-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onEdgeDelete={onEdgeDelete}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable={true}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        connectionLineStyle={{ stroke: '#2196f3' }}
        connectionLineType="smoothstep"
      >
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap nodeStrokeWidth={3} zoomable pannable position="bottom-left" />
        <Background variant="dots" gap={12} size={1} />
        
        {/* Floating action button to create new events */}
        <Panel position="top-right" className="flow-panel">
          <button 
            className="flow-fab"
            onClick={createEventNode}
            title="Create New Event"
          >
            +
          </button>
          
          <button 
            className="flow-export-btn"
            onClick={exportToJson}
            title="Export to JSON"
          >
            💾
          </button>
          
          <button 
            className="flow-import-btn"
            onClick={handleImportClick}
            title="Import from JSON"
          >
            📂
          </button>
          
          {/* Hidden file input for importing */}
          <input 
            type="file" 
            ref={fileInputRef}
            style={{ display: 'none' }} 
            accept=".json"
            onChange={importFromJson}
          />
        </Panel>

        {/* Control panel button */}
        <Panel position="top-left" className="flow-panel">
          <button 
            className="flow-control-toggle"
            onClick={() => setShowControls(!showControls)}
            title={showControls ? "Hide Controls" : "Show Controls"}
          >
            ⚙️
          </button>
          
          {/* Node controls appear when a node is selected */}
          {selectedNode && (
            <div className="flow-node-controls">
              <div className="node-controls-label">Event Options</div>
              <button 
                className="control-btn"
                onClick={setAsStarterEvent}
                title="Set as Starter Event"
              >
                🏁 Set as Starter
              </button>
              
              <button 
                className="control-btn"
                onClick={addOptionToEvent}
                title="Add Option"
              >
                ➕ Add Option
              </button>
              
              <button
                className="control-btn"
                onClick={handleEditEvent}
                title="Edit Event"
              >
                ✏️ Edit Event
              </button>
              
              <button 
                className="control-btn delete-btn"
                onClick={deleteSelectedNode}
                title="Delete Event"
              >
                🗑️ Delete Event
              </button>
            </div>
          )}
          
          {/* Extended controls panel */}
          {showControls && (
            <div className="flow-controls-panel">
              <div className="controls-label">Story Flow Controls</div>
              <div className="controls-section">
                <button 
                  className="control-btn"
                  onClick={createEventNode}
                >
                  Create New Event
                </button>
                
                <button 
                  className="control-btn"
                  onClick={exportToJson}
                >
                  Export to JSON
                </button>
                
                <button 
                  className="control-btn"
                  onClick={handleImportClick}
                >
                  Import from JSON
                </button>
                
                <div className="controls-info">
                  <p><strong>Tips:</strong></p>
                  <ul>
                    <li>Click on a node to select it</li>
                    <li>Double-click a node to edit its content</li>
                    <li>Drag from an option's handle to another event to connect them</li>
                    <li>Blue lines represent option connections</li>
                    <li>Events accept input connections on the left side</li>
                    <li>Options output connections from the right side</li>
                    <li>Export your storyline to save as JSON</li>
                    <li>Import a JSON file to restore a storyline</li>
                  </ul>
                  
                  <p><strong>JSON Format:</strong></p>
                  <p>Events are exported with options as text strings and links array for connections. The index in options matches the index in links.</p>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
      
      {/* Event Editor Modal */}
      {editingNodeId && editingNodeData && (
        <div className="modal-backdrop">
          <EventEditor 
            eventId={editingNodeId}
            eventData={editingNodeData}
            availableEvents={allEvents}
            onClose={handleEventEditorClose}
          />
        </div>
      )}
      
      <style jsx>{`
        .story-flow-container {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        .modal-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }
        
        .event-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
        }
        
        .option-text {
          flex: 1;
          margin-right: 10px;
        }
        
        .option-connection-indicator {
          color: #2196f3;
          font-weight: bold;
          margin-left: 5px;
        }
      `}</style>
    </div>
  );
};

export default StoryFlow; 