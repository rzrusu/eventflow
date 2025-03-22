import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom node for an event
const EventNode = ({ data }) => {
  return (
    <div className={`event-node ${data.isStarter ? 'starter-event' : ''}`}>
      <div className="event-node-header">
        <strong>{data.title || 'New Event'}</strong>
        {data.isStarter && <span className="starter-badge">Starter</span>}
      </div>
      <div className="event-node-content">
        <p>{data.content || 'Event content...'}</p>
      </div>
      <div className="event-node-options">
        {data.options && data.options.map((option, index) => (
          <div key={index} className="event-option">
            {option.text}
          </div>
        ))}
      </div>
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
  
  // Starter event for the current storyline
  const [starterEventId, setStarterEventId] = useState(null);
  
  // Counter for creating unique node IDs
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  
  // Track the selected node
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Toggle for control panel visibility
  const [showControls, setShowControls] = useState(false);

  // Effect to reset flow when storyline changes
  useEffect(() => {
    // In a real app, you would fetch the storyline data from your backend here
    console.log(`Loading storyline: ${storylineId}`);
    
    // For now, just reset the flow when storyline changes
    setNodes([]);
    setEdges([]);
    setStarterEventId(null);
    setNodeIdCounter(1);
    setSelectedNode(null);
  }, [storylineId]);

  // Handle connections between nodes
  const onConnect = useCallback((params) => {
    // Create an edge with a unique id
    const edge = {
      ...params,
      id: `edge-${params.source}-${params.target}`,
      animated: false,
      type: 'smoothstep'
    };
    
    setEdges((eds) => addEdge(edge, eds));
  }, [setEdges]);
  
  // Handle node selection
  const onNodeClick = (event, node) => {
    setSelectedNode(node.id);
  };
  
  // Handle click on canvas to deselect node
  const onPaneClick = () => {
    setSelectedNode(null);
  };

  // Create a new event node
  const createEventNode = () => {
    const newNodeId = `event-${nodeIdCounter}`;
    
    // Calculate position to avoid overlapping nodes
    // Position nodes in a grid-like pattern
    const nodesPerRow = 3;
    const xPosition = 150 + ((nodeIdCounter % nodesPerRow) * 300);
    const yPosition = 100 + (Math.floor(nodeIdCounter / nodesPerRow) * 200);
    
    const isFirstNode = nodes.length === 0;
    
    const newNode = {
      id: newNodeId,
      type: 'event',
      position: { x: xPosition, y: yPosition },
      data: {
        id: newNodeId,
        title: `Event ${nodeIdCounter}`,
        content: 'Double-click to edit this event',
        options: [],
        isStarter: isFirstNode // First node is automatically the starter
      }
    };
    
    setNodes((nds) => [...nds, newNode]);
    setNodeIdCounter((prevCounter) => prevCounter + 1);
    
    // If this is the first node, set it as the starter
    if (isFirstNode) {
      setStarterEventId(newNodeId);
    }
    
    return newNodeId;
  };

  // Set an event as the starting event for the current storyline
  const setAsStarterEvent = () => {
    if (!selectedNode) return;
    
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
    
    setStarterEventId(selectedNode);
  };

  // Add a new option to the selected event
  const addOptionToEvent = () => {
    if (!selectedNode) return;
    
    setNodes(nodes.map(node => {
      if (node.id === selectedNode) {
        const options = [...(node.data.options || [])];
        options.push({
          text: `Option ${options.length + 1}`,
          nextEventId: null
        });
        
        return {
          ...node,
          data: {
            ...node.data,
            options
          }
        };
      }
      return node;
    }));
  };

  // Delete the selected node
  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    
    // Remove the node
    setNodes(nodes.filter(node => node.id !== selectedNode));
    
    // Remove any edges connected to this node
    setEdges(edges.filter(edge => 
      edge.source !== selectedNode && edge.target !== selectedNode
    ));
    
    // If we deleted the starter event, clear the starterEventId
    if (selectedNode === starterEventId) {
      setStarterEventId(null);
    }
    
    setSelectedNode(null);
  };

  return (
    <div className="story-flow-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable={true}
        elementsSelectable={true}
        selectNodesOnDrag={false}
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
                className={`control-btn ${starterEventId === selectedNode ? 'disabled' : ''}`}
                onClick={setAsStarterEvent}
                disabled={starterEventId === selectedNode}
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
                
                <div className="controls-info">
                  <p><strong>Tips:</strong></p>
                  <ul>
                    <li>Click on a node to select it</li>
                    <li>Drag between nodes to connect them</li>
                    <li>The first node is automatically set as starter</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default StoryFlow; 