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
  // Helper function to summarize option connections
  const getOptionConnectionSummary = (option) => {
    if (!option.targets || option.targets.length === 0) {
      return { isConnected: false, info: 'Not connected' };
    } else if (option.targets.length === 1) {
      const targetEvent = data.allEvents?.find(e => e.id === option.targets[0].eventId);
      const probability = option.targets[0].probability || 1;
      const probabilityText = probability === 1 ? '' : ` (${Math.round(probability * 100)}%)`;
      return {
        isConnected: true,
        info: targetEvent ? `Connected to: ${targetEvent.title}${probabilityText}` : 'Connected'
      };
    } else {
      return {
        isConnected: true,
        info: `Connected to ${option.targets.length} events`
      };
    }
  };

  // Check if any option has a skill check
  const hasSkillCheckOptions = data.options && data.options.some(option => 
    option.skillCheck && option.skillCheck.skill
  );

  return (
    <div className={`event-node ${data.isStarter ? 'starter-event' : ''} ${hasSkillCheckOptions ? 'skill-check-event' : ''}`}>
      <div className="event-title">
        {data.title}
        {data.isStarter && <span className="starter-badge">Starter</span>}
        {hasSkillCheckOptions && <span className="skill-check-badge">Skill Check</span>}
      </div>
      <div className="event-content">
        {data.content && data.content.substring(0, 100)}
        {data.content && data.content.length > 100 ? '...' : ''}
      </div>
      <div className="event-options">
        {data.options && data.options.map((option, index) => {
          const connectionSummary = getOptionConnectionSummary(option);
          const hasSkillCheck = option.skillCheck && option.skillCheck.skill;
          
          return (
            <div
              key={index}
              className={`event-option ${connectionSummary.isConnected ? 'event-option-connected' : ''} ${hasSkillCheck ? 'event-option-skill-check' : ''}`}
              title={connectionSummary.info}
            >
              <div className="option-text">
                {option.text}
                {hasSkillCheck && (
                  <span className="option-skill-check">
                    {option.skillCheck.skill}: {option.skillCheck.minValue}+
                  </span>
                )}
              </div>
              {connectionSummary.isConnected && (
                <div className="option-connection-indicator">
                  {option.targets && option.targets.length > 1 
                    ? `${option.targets.length} paths` 
                    : '→'}
                </div>
              )}
              
              {/* For regular options or options with probability-based targeting */}
              {!hasSkillCheck && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`option-${index}`}
                  className="option-handle"
                  style={{ 
                    right: -4, 
                    top: '50%', 
                    background: connectionSummary.isConnected ? '#2196f3' : '#ddd',
                    border: connectionSummary.isConnected ? '2px solid #1565c0' : '2px solid #bbb'
                  }}
                />
              )}
              
              {/* For options with skill checks, add success and failure handles */}
              {hasSkillCheck && (
                <>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`option-${index}-success`}
                    className="option-handle success-handle"
                    style={{ 
                      right: -4, 
                      top: '35%', 
                      background: '#4caf50',
                      border: '2px solid #388e3c'
                    }}
                  />
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={`option-${index}-failure`}
                    className="option-handle failure-handle"
                    style={{ 
                      right: -4, 
                      top: '65%', 
                      background: '#f44336',
                      border: '2px solid #d32f2f'
                    }}
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="target"
        style={{ left: -4, background: '#ff9800', border: '2px solid #ef6c00' }}
      />
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

  // State for option probability editing
  const [editingProbabilities, setEditingProbabilities] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [optionTargets, setOptionTargets] = useState([]);

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
            let needsUpdate = false;
            const updatedOptions = [...event.options];
            
            // Convert string options to objects
            const hasStringOptions = event.options.some(opt => typeof opt === 'string');
            if (hasStringOptions) {
              needsUpdate = true;
              
              // Update string options to objects
              for (let i = 0; i < updatedOptions.length; i++) {
                if (typeof updatedOptions[i] === 'string') {
                  updatedOptions[i] = {
                    text: updatedOptions[i],
                    targets: []
                  };
                }
              }
            }
            
            // Convert nextEventId to targets array
            const hasNextEventId = event.options.some(opt => 
              typeof opt === 'object' && opt.nextEventId !== undefined
            );
            
            if (hasNextEventId) {
              needsUpdate = true;
              
              // Update options with nextEventId to use targets array
              for (let i = 0; i < updatedOptions.length; i++) {
                const opt = updatedOptions[i];
                if (typeof opt === 'object' && opt.nextEventId !== undefined) {
                  // Initialize targets array if needed
                  if (!opt.targets) {
                    opt.targets = [];
                  }
                  
                  // Add nextEventId as a target if it's not null and not already in targets
                  if (opt.nextEventId && !opt.targets.some(t => t.eventId === opt.nextEventId)) {
                    opt.targets.push({
                      eventId: opt.nextEventId,
                      probability: 1
                    });
                  }
                  
                  // Remove the nextEventId property
                  const { nextEventId, ...optWithoutNextEventId } = opt;
                  updatedOptions[i] = optWithoutNextEventId;
                }
              }
            }
            
            // Initialize skillCheck field if not present
            const needsSkillCheck = event.options.some(opt => opt.skillCheck === undefined);
            if (needsSkillCheck) {
              needsUpdate = true;
              
              // Add skillCheck field to options that don't have it
              for (let i = 0; i < updatedOptions.length; i++) {
                if (updatedOptions[i].skillCheck === undefined) {
                  updatedOptions[i].skillCheck = null;
                }
              }
            }
            
            // Update the event if changes were made
            if (needsUpdate) {
              // Update the event with the new options format
              await updateEvent(event.id, { options: updatedOptions });
            }
          }
        }
        
        // Get the fresh data after potential updates
        const updatedEvents = await loadEvents(storylineId);
        setAllEvents(updatedEvents);
        
        // Convert events to ReactFlow nodes
        const flowNodes = updatedEvents.map(event => {
          console.log(`Creating node with id: ${event.id}`);
          return {
            id: event.id,
            type: 'event',
            position: event.position || { x: 0, y: 0 },
            data: {
              ...event,
              isStarter: !!event.isStarter,
              allEvents: updatedEvents
            }
          };
        });
        
        // Create edges from options
        const flowEdges = [];
        
        updatedEvents.forEach(event => {
          // Add edges from options
          if (event.options && event.options.length > 0) {
            event.options.forEach((option, index) => {
              // Check if option has targets array with connections
              if (option.targets && option.targets.length > 0) {
                // Create an edge for each target
                option.targets.forEach(target => {
                  if (target.eventId) {
                    // Check if target node exists
                    const targetNodeExists = updatedEvents.some(e => e.id === target.eventId);
                    if (!targetNodeExists) {
                      console.warn(`Target node ${target.eventId} does not exist, skipping edge creation`);
                      return;
                    }
                    
                    // Check if this is a skill check outcome
                    if (option.skillCheck && target.isSkillCheckOutcome) {
                      // This is a skill check outcome (success or failure)
                      const isSuccess = target.isSuccess === true;
                      const sourceHandleId = `option-${index}-${isSuccess ? 'success' : 'failure'}`;
                      
                      console.log(`Creating skill check edge from ${event.id} to ${target.eventId} with sourceHandle: ${sourceHandleId}`);
                      
                      // Create edge for skill check outcome
                      flowEdges.push({
                        id: `edge-${isSuccess ? 'success' : 'failure'}-${event.id}-${target.eventId}-${index}`,
                        source: event.id,
                        target: target.eventId,
                        sourceHandle: sourceHandleId,
                        targetHandle: 'target',
                        type: 'default',
                        animated: true,
                        label: isSuccess ? 'Success' : 'Failure',
                        className: isSuccess ? 'success-edge' : 'failure-edge'
                      });
                    } else {
                      // Regular probability-based edge
                      // Calculate probability percentage for the label
                      const probability = target.probability || 1;
                      const probabilityText = Math.round(probability * 100);
                      
                      // Debug edge creation
                      console.log(`Creating edge from ${event.id} to ${target.eventId} with sourceHandle: option-${index} and targetHandle: target`);
                      
                      flowEdges.push({
                        id: `edge-option-${event.id}-${target.eventId}-${index}`,
                        source: event.id,
                        target: target.eventId,
                        sourceHandle: `option-${index}`,
                        targetHandle: 'target',
                        type: 'default',
                        animated: true,
                        label: `${probabilityText}%`
                      });
                    }
                  }
                });
              }
              // Handle legacy nextEventId for backward compatibility
              else if (option.nextEventId) {
                // Check if target node exists
                const targetNodeExists = updatedEvents.some(e => e.id === option.nextEventId);
                if (!targetNodeExists) {
                  console.warn(`Target node ${option.nextEventId} does not exist, skipping legacy edge creation`);
                  return;
                }
                
                flowEdges.push({
                  id: `edge-option-${event.id}-${option.nextEventId}-${index}`,
                  source: event.id,
                  target: option.nextEventId,
                  sourceHandle: `option-${index}`,
                  targetHandle: 'target',
                  type: 'default',
                  animated: true,
                  label: '100%'
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

  // Handle connecting nodes
  const onConnect = useCallback(async (connection) => {
    const { source, target, sourceHandle, targetHandle } = connection;
    
    console.log("Connection attempt:", { source, target, sourceHandle, targetHandle });
    
    if (!source || !target) {
      console.error("Missing source or target in connection:", connection);
      return;
    }
    
    // Check if connection is from an option handle (source)
    if (sourceHandle && sourceHandle.startsWith('option-')) {
      try {
        // Parse the sourceHandle to determine if it's a regular option or a skill check
        let optionIndex;
        let isSkillCheck = false;
        let isSuccess = false;
        
        // Split the handle ID to get its components
        const handleParts = sourceHandle.split('-');
        
        if (handleParts.length === 3) {
          // This is a skill check outcome: 'option-INDEX-success|failure'
          optionIndex = parseInt(handleParts[1], 10);
          isSkillCheck = true;
          isSuccess = handleParts[2] === 'success';
          console.log(`Detected skill check ${isSuccess ? 'success' : 'failure'} connection for option ${optionIndex}`);
        } else if (handleParts.length === 2) {
          // Regular option: 'option-INDEX'
          optionIndex = parseInt(handleParts[1], 10);
          console.log(`Detected regular connection for option ${optionIndex}`);
        } else {
          console.error("Invalid handle format:", sourceHandle);
          return;
        }
        
        // Get the source node
        const sourceNode = nodes.find(n => n.id === source);
        if (!sourceNode || !sourceNode.data || !sourceNode.data.options || !sourceNode.data.options[optionIndex]) {
          console.error(`Source node or option index ${optionIndex} not found:`, sourceNode);
          return;
        }
        
        // Initialize targets array if it doesn't exist
        if (!sourceNode.data.options[optionIndex].targets) {
          sourceNode.data.options[optionIndex].targets = [];
        }
        
        // Handle skill check connections differently
        if (isSkillCheck) {
          // For skill checks, check if there's already a connection for this outcome (success/failure)
          const existingTargetIndex = sourceNode.data.options[optionIndex].targets.findIndex(
            t => t.eventId === target && t.isSkillCheckOutcome === true && t.isSuccess === isSuccess
          );
          
          if (existingTargetIndex === -1) {
            console.log(`Adding new skill check ${isSuccess ? 'success' : 'failure'} target:`, target);
            
            // Add the new target with skill check outcome information
            sourceNode.data.options[optionIndex].targets.push({
              eventId: target,
              isSkillCheckOutcome: true,
              isSuccess: isSuccess,
              probability: 1 // Not used for skill checks but keeping for consistency
            });
          } else {
            // Target already exists, don't create duplicate connection
            console.log(`Target already exists for ${isSuccess ? 'success' : 'failure'} outcome:`, target);
            return;
          }
        } else {
          // Handle regular probability-based connections
          // Check if target already exists
          const existingTargetIndex = sourceNode.data.options[optionIndex].targets.findIndex(
            t => t.eventId === target
          );
          
          // If the target doesn't exist, add it with default probability
          if (existingTargetIndex === -1) {
            // Calculate default probability (equal distribution)
            const newProbability = 1 / (sourceNode.data.options[optionIndex].targets.length + 1);
            
            console.log(`Adding new probability-based target with ${newProbability * 100}% probability:`, target);
            
            // Add the new target
            sourceNode.data.options[optionIndex].targets.push({
              eventId: target,
              probability: newProbability
            });
            
            // Normalize probabilities for all targets
            sourceNode.data.options[optionIndex].targets = sourceNode.data.options[optionIndex].targets.map(t => ({
              ...t,
              probability: newProbability
            }));
          } else {
            // Target already exists, don't create duplicate connection
            console.log(`Target already exists:`, target);
            return;
          }
        }
        
        // Create links array with unique eventIds from all targets
        const links = [];
        sourceNode.data.options.forEach(opt => {
          if (opt.targets && opt.targets.length > 0) {
            opt.targets.forEach(target => {
              if (target.eventId && !links.includes(target.eventId)) {
                links.push(target.eventId);
              }
            });
          }
        });
        
        // Update the event in the database
        await updateEvent(source, {
          options: sourceNode.data.options,
          links
        });
        
        // Get the target event title for edge information
        const targetEvent = allEvents.find(e => e.id === target);
        const targetTitle = targetEvent ? targetEvent.title : 'Unknown Event';
        
        // Create an edge
        let edgeId;
        let edgeLabel;
        let edgeClass = '';
        
        if (isSkillCheck) {
          // For skill check edges
          edgeId = `edge-${isSuccess ? 'success' : 'failure'}-${source}-${target}-${optionIndex}`;
          edgeLabel = isSuccess ? 'Success' : 'Failure';
          edgeClass = isSuccess ? 'success-edge' : 'failure-edge';
          console.log(`Creating skill check edge: ${edgeId}, label: ${edgeLabel}`);
        } else {
          // For probability-based edges
          edgeId = `edge-option-${source}-${target}-${optionIndex}`;
          const probability = sourceNode.data.options[optionIndex].targets.find(t => t.eventId === target)?.probability || 0;
          const probabilityText = Math.round(probability * 100);
          edgeLabel = `${probabilityText}%`;
          console.log(`Creating probability edge: ${edgeId}, label: ${edgeLabel}`);
        }
        
        // Create edge
        const edge = {
          id: edgeId,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: 'default',
          animated: true,
          label: edgeLabel,
          className: edgeClass
        };
        
        // Add the edge to the flow
        setEdges(prevEdges => [...prevEdges, edge]);
        
        // Update the source node in the flow to reflect the new connection
        setNodes(prevNodes => prevNodes.map(node => 
          node.id === source 
            ? { ...node, data: { ...node.data, options: sourceNode.data.options } } 
            : node
        ));
      } catch (error) {
        console.error('Error connecting nodes:', error);
        alert('Error connecting nodes. Please try again.');
      }
    }
  }, [nodes, allEvents, setEdges, setNodes, updateEvent]);

  // Handle deleting edges
  const onEdgeDelete = useCallback(async (edge) => {
    console.log("Attempting to delete edge:", edge);
    
    if (!edge || !edge.id) {
      console.error("Invalid edge for deletion:", edge);
      return;
    }
    
    try {
      // Parse edge ID based on its type
      if (edge.id.startsWith('edge-option')) {
        // Regular probability-based edge
        // Format: edge-option-${source}-${target}-${optionIndex}
        const [, , source, target, optionIndexStr] = edge.id.split('-');
        const optionIndex = parseInt(optionIndexStr, 10);
        
        console.log(`Deleting probability edge from option ${optionIndex} in event ${source} to ${target}`);
        
        // Get the source node
        const sourceNode = nodes.find(n => n.id === source);
        if (!sourceNode || !sourceNode.data || !sourceNode.data.options || !sourceNode.data.options[optionIndex]) {
          console.error("Source node or option not found:", source, optionIndex);
          return;
        }
        
        // Check if option has targets
        if (!sourceNode.data.options[optionIndex].targets || sourceNode.data.options[optionIndex].targets.length === 0) {
          console.error("Option has no targets:", sourceNode.data.options[optionIndex]);
          return;
        }
        
        // Remove the target from the targets array
        const updatedTargets = sourceNode.data.options[optionIndex].targets.filter(
          t => t.eventId !== target
        );
        
        // Update the option's targets array
        const updatedOptions = [...sourceNode.data.options];
        updatedOptions[optionIndex] = {
          ...updatedOptions[optionIndex],
          targets: updatedTargets
        };
        
        // If there are remaining targets, normalize their probabilities
        if (updatedTargets.length > 0) {
          const equalProbability = 1 / updatedTargets.length;
          updatedOptions[optionIndex].targets = updatedTargets.map(target => ({
            ...target,
            probability: equalProbability
          }));
        }
        
        // Create links array with unique eventIds from all targets
        const links = [];
        updatedOptions.forEach(opt => {
          if (opt.targets && opt.targets.length > 0) {
            opt.targets.forEach(target => {
              if (target.eventId && !links.includes(target.eventId)) {
                links.push(target.eventId);
              }
            });
          }
        });
        
        // Update the event in the database
        await updateEvent(source, {
          options: updatedOptions,
          links
        });
        
        // Update the source node in the flow
        setNodes(prevNodes => prevNodes.map(node => 
          node.id === source 
            ? { ...node, data: { ...node.data, options: updatedOptions } } 
            : node
        ));
        
        // Remove the edge
        setEdges(prevEdges => prevEdges.filter(e => e.id !== edge.id));
      }
      else if (edge.id.startsWith('edge-success') || edge.id.startsWith('edge-failure')) {
        // Skill check edge
        // Format: edge-success-${source}-${target}-${optionIndex} or edge-failure-${source}-${target}-${optionIndex}
        const parts = edge.id.split('-');
        const isSuccess = parts[1] === 'success';
        const source = parts[2];
        const target = parts[3];
        const optionIndex = parseInt(parts[4], 10);
        
        console.log(`Deleting ${isSuccess ? 'success' : 'failure'} edge from option ${optionIndex} in event ${source} to ${target}`);
        
        // Get the source node
        const sourceNode = nodes.find(n => n.id === source);
        if (!sourceNode || !sourceNode.data || !sourceNode.data.options || !sourceNode.data.options[optionIndex]) {
          console.error("Source node or option not found:", source, optionIndex);
          return;
        }
        
        // Check if option has targets and skill check
        if (!sourceNode.data.options[optionIndex].targets || 
            sourceNode.data.options[optionIndex].targets.length === 0 ||
            !sourceNode.data.options[optionIndex].skillCheck) {
          console.error("Option has no targets or no skill check:", sourceNode.data.options[optionIndex]);
          return;
        }
        
        // Print current targets for debugging
        console.log("Current targets before deletion:", sourceNode.data.options[optionIndex].targets);
        
        // Remove the specific skill check outcome target
        const updatedTargets = sourceNode.data.options[optionIndex].targets.filter(
          t => !(t.eventId === target && t.isSkillCheckOutcome === true && t.isSuccess === isSuccess)
        );
        
        console.log("Targets after deletion:", updatedTargets);
        
        // Update the option's targets array
        const updatedOptions = [...sourceNode.data.options];
        updatedOptions[optionIndex] = {
          ...updatedOptions[optionIndex],
          targets: updatedTargets
        };
        
        // Create links array with unique eventIds from all targets
        const links = [];
        updatedOptions.forEach(opt => {
          if (opt.targets && opt.targets.length > 0) {
            opt.targets.forEach(target => {
              if (target.eventId && !links.includes(target.eventId)) {
                links.push(target.eventId);
              }
            });
          }
        });
        
        // Update the event in the database
        await updateEvent(source, {
          options: updatedOptions,
          links
        });
        
        // Update the source node in the flow
        setNodes(prevNodes => prevNodes.map(node => 
          node.id === source 
            ? { ...node, data: { ...node.data, options: updatedOptions } } 
            : node
        ));
        
        // Remove the edge
        setEdges(prevEdges => prevEdges.filter(e => e.id !== edge.id));
      }
      else {
        console.error("Unknown edge type for deletion:", edge);
      }
    } catch (error) {
      console.error('Error removing connection:', error);
      alert('Error removing connection. Please try again.');
    }
  }, [nodes, setNodes, setEdges, updateEvent]);
  
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
    
    // Create a new option with the new structure
    const options = [...(node.data.options || [])];
    options.push({
      text: `Option ${options.length + 1}`,
      targets: [] // Initialize with empty targets array instead of nextEventId
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
  
  // Handle closing the event editor and refreshing nodes
  const handleEventEditorClose = async () => {
    setEditingNodeId(null);
    setEditingNodeData(null);
    
    try {
      // Reload events from the database
      const dbEvents = await loadEvents(storylineId);
      setAllEvents(dbEvents);
      
      // Update nodes with fresh data
      setNodes(prevNodes => 
        prevNodes.map(node => {
          const updatedEvent = dbEvents.find(e => e.id === node.id);
          if (updatedEvent) {
            return {
              ...node,
              data: {
                ...updatedEvent,
                isStarter: !!updatedEvent.isStarter,
                allEvents: dbEvents
              }
            };
          }
          return node;
        })
      );
      
      // Rebuild edges
      const newEdges = [];
      
      dbEvents.forEach(event => {
        // Add edges from options
        if (event.options && event.options.length > 0) {
          event.options.forEach((option, index) => {
            // Check if option has targets array with connections
            if (option.targets && option.targets.length > 0) {
              // Create an edge for each target
              option.targets.forEach(target => {
                if (target.eventId) {
                  // Check if target node exists
                  const targetNodeExists = dbEvents.some(e => e.id === target.eventId);
                  if (!targetNodeExists) {
                    console.warn(`Target node ${target.eventId} does not exist, skipping edge creation`);
                    return;
                  }
                  
                  // Check if this is a skill check outcome
                  if (option.skillCheck && target.isSkillCheckOutcome) {
                    // This is a skill check outcome (success or failure)
                    const isSuccess = target.isSuccess === true;
                    const sourceHandleId = `option-${index}-${isSuccess ? 'success' : 'failure'}`;
                    
                    console.log(`Creating skill check edge from ${event.id} to ${target.eventId} with sourceHandle: ${sourceHandleId}`);
                    
                    // Create edge for skill check outcome
                    newEdges.push({
                      id: `edge-${isSuccess ? 'success' : 'failure'}-${event.id}-${target.eventId}-${index}`,
                      source: event.id,
                      target: target.eventId,
                      sourceHandle: sourceHandleId,
                      targetHandle: 'target',
                      type: 'default',
                      animated: true,
                      label: isSuccess ? 'Success' : 'Failure',
                      className: isSuccess ? 'success-edge' : 'failure-edge'
                    });
                  } else {
                    // Regular probability-based edge
                    // Calculate probability percentage for the label
                    const probability = target.probability || 1;
                    const probabilityText = Math.round(probability * 100);
                    
                    // Debug edge creation in handleEventEditorClose
                    console.log(`Creating edge after edit: ${event.id} to ${target.eventId}, sourceHandle: option-${index}, targetHandle: target`);
                    
                    newEdges.push({
                      id: `edge-option-${event.id}-${target.eventId}-${index}`,
                      source: event.id,
                      target: target.eventId,
                      sourceHandle: `option-${index}`,
                      targetHandle: 'target',
                      type: 'default',
                      animated: true,
                      label: `${probabilityText}%`
                    });
                  }
                }
              });
            }
            // Handle legacy nextEventId for backward compatibility
            else if (option.nextEventId) {
              // Check if target node exists
              const targetNodeExists = dbEvents.some(e => e.id === option.nextEventId);
              if (!targetNodeExists) {
                console.warn(`Target node ${option.nextEventId} does not exist, skipping legacy edge creation`);
                return;
              }
              
              newEdges.push({
                id: `edge-option-${event.id}-${option.nextEventId}-${index}`,
                source: event.id,
                target: option.nextEventId,
                sourceHandle: `option-${index}`,
                targetHandle: 'target',
                type: 'default',
                animated: true,
                label: '100%'
              });
            }
          });
        }
      });
      
      setEdges(newEdges);
    } catch (error) {
      console.error('Error refreshing flow after editing event:', error);
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
      // Create a formatted JSON structure from events
      const exportData = allEvents.map(event => {
        // Get the node to access position data
        const node = nodes.find(n => n.id === event.id);
        
        // Process options data
        const processedOptions = (event.options || []).map((option, index) => {
          // Get all targets for this option
          const targets = option.targets || [];
          
          // Check if this is a skill check option
          if (option.skillCheck && option.skillCheck.skill) {
            // For skill check options, we need to organize targets by success/failure
            const successTargets = targets
              .filter(t => t.isSkillCheckOutcome && t.isSuccess)
              .map(t => t.eventId);
              
            const failureTargets = targets
              .filter(t => t.isSkillCheckOutcome && !t.isSuccess)
              .map(t => t.eventId);
              
            return {
              text: option.text,
              skillCheck: option.skillCheck,
              successTargets: successTargets,
              failureTargets: failureTargets,
              effects: option.effects || []
            };
          } else {
            // For regular probability-based options
            return {
              text: option.text,
              optionTargets: targets.map(target => target.eventId),
              optionProbabilities: targets.map(target => target.probability || 1),
              effects: option.effects || []
            };
          }
        });
        
        // Create final event object
        return {
          id: event.id,
          title: event.title || '',
          content: event.content || '',
          isStarter: event.isStarter || false,
          position: node?.position || { x: 0, y: 0 },
          options: processedOptions
        };
      });
      
      // Create and download JSON file
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `storyline_${storylineId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      alert('Failed to export storyline to JSON');
    }
  };

  // Import storyline from JSON
  const importFromJson = async (e) => {
    if (!storylineId) {
      alert('Please select a storyline first');
      return;
    }
    
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // Read the file
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate it's an array
      if (!Array.isArray(data)) {
        alert('Invalid format: JSON must be an array of events');
        return;
      }
      
      // Check if there's at least one event
      if (data.length === 0) {
        alert('No events found in the JSON file');
        return;
      }
      
      // Ask for confirmation if there are existing events
      if (allEvents.length > 0) {
        const confirm = window.confirm(
          `This will replace all existing events in this storyline. Continue?`
        );
        
        if (!confirm) {
          // Reset the file input
          e.target.value = '';
          return;
        }
        
        // Delete existing events
        for (const event of allEvents) {
          await deleteEvent(event.id);
        }
      }
      
      // Process and import events
      const importedEvents = [];
      
      for (const eventData of data) {
        // Extract basic event data
        const { id, title, content, position, isStarter } = eventData;
        
        // Format options based on the data format
        let formattedOptions = [];
        
        // Case 1: Options with both optionTargets and optionEffects/skillChecks (new format)
        if (Array.isArray(eventData.options) && typeof eventData.options[0] === 'object') {
          formattedOptions = eventData.options.map(opt => {
            // Base option object with text
            const formattedOption = {
              text: opt.text || 'Option',
              targets: [],
              effects: []
            };
            
            // Process skill check option
            if (opt.skillCheck && (opt.successTargets || opt.failureTargets)) {
              // Add skill check to the option
              formattedOption.skillCheck = {
                skill: opt.skillCheck.skill || '',
                minValue: opt.skillCheck.minValue || 0
              };
              
              // Add success targets
              if (Array.isArray(opt.successTargets)) {
                opt.successTargets.forEach(targetId => {
                  formattedOption.targets.push({
                    eventId: targetId,
                    isSkillCheckOutcome: true,
                    isSuccess: true,
                    probability: 1 // Not used but keeping for consistency
                  });
                });
              }
              
              // Add failure targets
              if (Array.isArray(opt.failureTargets)) {
                opt.failureTargets.forEach(targetId => {
                  formattedOption.targets.push({
                    eventId: targetId,
                    isSkillCheckOutcome: true,
                    isSuccess: false,
                    probability: 1 // Not used but keeping for consistency
                  });
                });
              }
            } 
            // Process probability-based option
            else if (Array.isArray(opt.optionTargets)) {
              // Add targets with probabilities
              const optionTargets = opt.optionTargets || [];
              const optionProbabilities = opt.optionProbabilities || Array(optionTargets.length).fill(1/Math.max(1, optionTargets.length));
              
              optionTargets.forEach((targetId, i) => {
                const probability = i < optionProbabilities.length ? optionProbabilities[i] : 1/optionTargets.length;
                formattedOption.targets.push({
                  eventId: targetId,
                  probability
                });
              });
            }
            
            // Add effects if present
            if (Array.isArray(opt.effects)) {
              formattedOption.effects = opt.effects.map(effect => ({
                skill: effect.skill || '',
                value: effect.value || 0
              }));
            }
            
            return formattedOption;
          });
        }
        // Case 2: Old format with arrays
        else if (Array.isArray(eventData.options) && Array.isArray(eventData.optionTargets)) {
          // Convert string options and targets arrays to objects
          formattedOptions = eventData.options.map((text, index) => {
            const option = {
              text,
              targets: [],
              effects: []
            };
            
            // Add targets if available
            if (eventData.optionTargets && eventData.optionTargets[index]) {
              const targets = eventData.optionTargets[index];
              const probabilities = eventData.optionProbabilities && eventData.optionProbabilities[index];
              
              if (Array.isArray(targets)) {
                targets.forEach((target, i) => {
                  const targetId = typeof target === 'object' ? target.eventId : target;
                  const probability = 
                    (probabilities && i < probabilities.length) ? probabilities[i] : 
                    (typeof target === 'object' ? target.probability : 1/targets.length);
                  
                  option.targets.push({
                    eventId: targetId,
                    probability
                  });
                });
              }
            }
            
            // Add effects if available
            if (eventData.optionEffects && eventData.optionEffects[index]) {
              const effects = eventData.optionEffects[index];
              
              if (Array.isArray(effects)) {
                option.effects = effects.map(effect => ({
                  skill: effect.skill || '',
                  value: effect.value || 0
                }));
              }
            }
            
            return option;
          });
        }
        // Case 3: Simple string options
        else if (Array.isArray(eventData.options) && typeof eventData.options[0] === 'string') {
          formattedOptions = eventData.options.map(text => ({
            text,
            targets: [],
            effects: []
          }));
        }
        
        // Create links array with unique eventIds from all targets
        const links = [];
        formattedOptions.forEach(opt => {
          if (opt.targets && opt.targets.length > 0) {
            opt.targets.forEach(target => {
              if (target.eventId && !links.includes(target.eventId)) {
                links.push(target.eventId);
              }
            });
          }
        });
        
        // Create the event
        const newEvent = await createEvent(storylineId, {
          id: id || `event_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          title: title || 'Untitled Event',
          content: content || '',
          options: formattedOptions,
          links,
          position: position || { x: 0, y: 0 },
          isStarter: !!isStarter
        });
        
        importedEvents.push(newEvent);
      }
      
      // Reset the file input
      e.target.value = '';
      
      // Refresh the flow
      await loadEvents(storylineId);
      
      alert(`Successfully imported ${importedEvents.length} events!`);
    } catch (error) {
      console.error('Error importing storyline:', error);
      alert('Error importing storyline. Check console for details.');
      // Reset the file input
      e.target.value = '';
    }
  };
  
  // Trigger file input click
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Edit option probabilities
  const handleEditProbabilities = () => {
    if (!selectedNode) return;
    
    // Find the node
    const node = nodes.find(n => n.id === selectedNode);
    if (!node || !node.data.options || node.data.options.length === 0) return;
    
    // Open the probability editor with the first option that has multiple targets
    const optionWithMultipleTargets = node.data.options.findIndex(
      opt => opt.targets && opt.targets.length > 1
    );
    
    // If none have multiple targets, use the first option with at least one target
    const optionWithTarget = node.data.options.findIndex(
      opt => opt.targets && opt.targets.length > 0
    );
    
    const optionIndex = optionWithMultipleTargets !== -1 ? 
      optionWithMultipleTargets : optionWithTarget;
    
    if (optionIndex !== -1) {
      setSelectedOption({
        nodeId: selectedNode,
        optionIndex,
        option: node.data.options[optionIndex]
      });
      
      setOptionTargets([...node.data.options[optionIndex].targets]);
      setEditingProbabilities(true);
    } else {
      alert('This event has no options with connections. Create connections first by dragging from option handles to other events.');
    }
  };
  
  // Handle changing the selected option
  const handleOptionChange = (e) => {
    const optionIndex = parseInt(e.target.value, 10);
    const node = nodes.find(n => n.id === selectedNode);
    
    if (node && node.data.options && node.data.options[optionIndex]) {
      setSelectedOption({
        nodeId: selectedNode,
        optionIndex,
        option: node.data.options[optionIndex]
      });
      
      setOptionTargets([...node.data.options[optionIndex].targets]);
    }
  };
  
  // Update a target's probability
  const updateTargetProbability = (targetIndex, value) => {
    const newValue = parseFloat(value);
    if (isNaN(newValue) || newValue < 0) return;
    
    const updatedTargets = [...optionTargets];
    updatedTargets[targetIndex] = {
      ...updatedTargets[targetIndex],
      probability: newValue
    };
    
    setOptionTargets(updatedTargets);
  };
  
  // Normalize probabilities to sum to 1
  const normalizeProbabilities = () => {
    if (!optionTargets || optionTargets.length === 0) return;
    
    const sum = optionTargets.reduce((acc, target) => acc + (target.probability || 0), 0);
    
    if (sum === 0) {
      // If all are zero, set equal probabilities
      const equalProbability = 1 / optionTargets.length;
      const normalizedTargets = optionTargets.map(target => ({
        ...target,
        probability: equalProbability
      }));
      setOptionTargets(normalizedTargets);
    } else {
      // Otherwise normalize to sum to 1
      const normalizedTargets = optionTargets.map(target => ({
        ...target,
        probability: (target.probability || 0) / sum
      }));
      setOptionTargets(normalizedTargets);
    }
  };
  
  // Even distribution of probabilities
  const evenDistribution = () => {
    if (!optionTargets || optionTargets.length === 0) return;
    
    const equalProbability = 1 / optionTargets.length;
    const updatedTargets = optionTargets.map(target => ({
      ...target,
      probability: equalProbability
    }));
    
    setOptionTargets(updatedTargets);
  };
  
  // Save probability changes
  const saveProbabilityChanges = async () => {
    if (!selectedOption) return;
    
    try {
      // Normalize probabilities before saving
      const sum = optionTargets.reduce((acc, target) => acc + (target.probability || 0), 0);
      const normalizedTargets = optionTargets.map(target => ({
        ...target,
        probability: sum > 0 ? (target.probability || 0) / sum : 1 / optionTargets.length
      }));
      
      // Get the current node and options
      const node = nodes.find(n => n.id === selectedOption.nodeId);
      if (!node) return;
      
      const updatedOptions = [...node.data.options];
      
      // Update the option's targets
      updatedOptions[selectedOption.optionIndex] = {
        ...updatedOptions[selectedOption.optionIndex],
        targets: normalizedTargets
      };
      
      // Collect all target eventIds for the links array
      const links = [];
      updatedOptions.forEach(opt => {
        if (opt.targets && opt.targets.length > 0) {
          opt.targets.forEach(target => {
            if (target.eventId && !links.includes(target.eventId)) {
              links.push(target.eventId);
            }
          });
        }
      });
      
      // Update the event in the database
      await updateEvent(selectedOption.nodeId, {
        options: updatedOptions,
        links
      });
      
      // Close the dialog
      setEditingProbabilities(false);
      
      // Reload the edges to reflect new probabilities
      await handleEventEditorClose();
    } catch (error) {
      console.error('Error saving probability changes:', error);
      alert('Error saving changes. Please try again.');
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
        deleteKeyCode="Delete"
        onEdgesDelete={(edges) => {
          edges.forEach(edge => onEdgeDelete(edge));
        }}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        nodesDraggable={true}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        connectionLineType="default"
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
                className="control-btn"
                onClick={handleEditProbabilities}
                title="Edit Option Probabilities"
              >
                🎲 Edit Probabilities
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
                  title="Create a new event node in the flow"
                >
                  ➕ Create New Event
                </button>
                
                <button 
                  className="control-btn"
                  onClick={exportToJson}
                  title="Export this storyline to a JSON file"
                >
                  💾 Export to JSON
                </button>
                
                <button 
                  className="control-btn"
                  onClick={handleImportClick}
                  title="Import a storyline from a JSON file"
                >
                  📂 Import from JSON
                </button>
                
                <div className="json-instructions">
                  <strong>JSON Structure:</strong>
                  <div>Each event has:</div>
                  <ul>
                    <li><code>title</code>: Event title</li>
                    <li><code>content</code>: Event description</li>
                    <li><code>options</code>: Array of text options</li>
                    <li><code>optionTargets</code>: Array of target connections for each option
                      <ul>
                        <li>Each target has an <code>eventId</code> and <code>probability</code></li>
                        <li>Probabilities determine the chance of following that path</li>
                        <li>Multiple connections from a single option are possible</li>
                      </ul>
                    </li>
                    <li><code>optionEffects</code>: Array of skill effects for each option
                      <ul>
                        <li>Each effect has a <code>skill</code> name and <code>value</code> modifier</li>
                        <li>Values can be positive or negative to increase or decrease skills</li>
                        <li>Multiple effects can be applied by a single option</li>
                      </ul>
                    </li>
                    <li><code>skillCheck</code>: Define skill requirements for options
                      <ul>
                        <li>Each skill check has a <code>skill</code> name and <code>minValue</code> requirement</li>
                        <li>Connect success path from the green (top) handle</li>
                        <li>Connect failure path from the red (bottom) handle</li>
                      </ul>
                    </li>
                    <li><code>position</code>: X,Y coordinates for layout</li>
                    <li><code>isStarter</code>: Set to true for the starting event</li>
                  </ul>
                  <div>To create connections with probabilities:</div>
                  <ol>
                    <li>Select an event and add options</li>
                    <li>Drag from the option handle to other events</li>
                    <li>Use the "Edit Probabilities" button to set chances</li>
                    <li>Probability values will normalize to add up to 100%</li>
                  </ol>
                  <div>To add skill effects to options:</div>
                  <ol>
                    <li>Select an event and add options</li>
                    <li>Click the "Effects" button next to an option</li>
                    <li>Add skills and their numeric modifiers</li>
                    <li>These effects will apply when the player selects this option</li>
                  </ol>
                  <div>To create skill check options:</div>
                  <ol>
                    <li>Select an event and add options</li>
                    <li>Click the "Skill Check" button next to an option</li>
                    <li>Define the skill name and minimum value required</li>
                    <li>Connect success path (green handle) to the success event</li>
                    <li>Connect failure path (red handle) to the failure event</li>
                  </ol>
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
      
      {/* Probability Editor Modal */}
      {editingProbabilities && selectedOption && (
        <div className="modal-backdrop">
          <div className="probability-editor">
            <div className="probability-editor-header">
              <h3>Edit Option Probabilities</h3>
              <button 
                className="close-btn"
                onClick={() => setEditingProbabilities(false)}
              >
                ×
              </button>
            </div>
            
            <div className="probability-editor-content">
              <div className="form-group">
                <label>Select Option:</label>
                <select 
                  value={selectedOption.optionIndex}
                  onChange={handleOptionChange}
                  className="option-select"
                >
                  {nodes.find(n => n.id === selectedOption.nodeId)?.data.options.map((opt, index) => (
                    <option key={index} value={index}>
                      {opt.text} ({opt.targets?.length || 0} connections)
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="option-text-preview">
                "{selectedOption.option.text}"
              </div>
              
              {optionTargets.length > 0 ? (
                <>
                  <div className="targets-list">
                    <div className="targets-header">
                      <span>Target Event</span>
                      <span>Probability</span>
                    </div>
                    
                    {optionTargets.map((target, index) => {
                      const targetEvent = allEvents.find(e => e.id === target.eventId);
                      return (
                        <div key={index} className="target-item">
                          <span className="target-title">
                            {targetEvent ? targetEvent.title : 'Unknown Event'}
                          </span>
                          <div className="probability-input-group">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={target.probability || 0}
                              onChange={(e) => updateTargetProbability(index, e.target.value)}
                              className="probability-input"
                            />
                            <span className="probability-percent">
                              ({Math.round((target.probability || 0) * 100)}%)
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="probability-actions">
                    <button 
                      className="prob-action-btn"
                      onClick={normalizeProbabilities}
                      title="Normalize values to add up to 100%"
                    >
                      Normalize
                    </button>
                    <button 
                      className="prob-action-btn"
                      onClick={evenDistribution}
                      title="Set equal probabilities for all connections"
                    >
                      Even Distribution
                    </button>
                  </div>
                  
                  <div className="probability-sum">
                    Total: {Math.round(optionTargets.reduce((sum, t) => sum + (t.probability || 0), 0) * 100)}%
                  </div>
                </>
              ) : (
                <div className="no-targets-message">
                  This option has no connections. Create connections by dragging from the option handle to other events.
                </div>
              )}
            </div>
            
            <div className="probability-editor-footer">
              <button 
                className="cancel-btn"
                onClick={() => setEditingProbabilities(false)}
              >
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={saveProbabilityChanges}
                disabled={optionTargets.length === 0}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
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