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
  
  // Check if this event has trigger requirements
  const hasTriggerRequirements = data.triggerRequirements && data.triggerRequirements.length > 0;

  return (
    <div className={`event-node ${data.isStarter ? 'starter-event' : ''} ${hasSkillCheckOptions ? 'skill-check-event' : ''} ${hasTriggerRequirements ? 'trigger-req-event' : ''}`}>
      <div className="event-title">
        {data.title}
        {data.isStarter && <span className="starter-badge">Starter</span>}
        {hasSkillCheckOptions && <span className="skill-check-badge">Skill Check</span>}
        {hasTriggerRequirements && <span className="trigger-req-badge">Triggers</span>}
      </div>
      <div className="event-content">
        {data.content && data.content.substring(0, 100)}
        {data.content && data.content.length > 100 ? '...' : ''}
      </div>
      {hasTriggerRequirements && (
        <div className="event-trigger-requirements">
          {data.triggerRequirements.map((trigger, index) => (
            <div key={index} className="trigger-requirement">
              {trigger.key}: {trigger.value}
              {index < data.triggerRequirements.length - 1 && ", "}
            </div>
          ))}
        </div>
      )}
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
  
  // Track the selected edge
  const [selectedEdge, setSelectedEdge] = useState(null);
  
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
      // Use edge properties directly instead of parsing the ID
      const source = edge.source;
      const target = edge.target;
      let optionIndex = -1;
      let isSkillCheck = false;
      let isSuccess = false;
      
      // Get sourceHandle to determine option index and edge type
      if (edge.sourceHandle) {
        // Parse the sourceHandle to get the option index and type
        const handleParts = edge.sourceHandle.split('-');
        if (handleParts.length >= 2) {
          // Extract option index from the handle
          optionIndex = parseInt(handleParts[1], 10);
          
          // Check if this is a skill check edge
          if (handleParts.length === 3) {
            isSkillCheck = true;
            isSuccess = handleParts[2] === 'success';
          }
        }
      }
      
      console.log(`Edge information extracted: source=${source}, target=${target}, optionIndex=${optionIndex}, isSkillCheck=${isSkillCheck}, isSuccess=${isSuccess}`);
      
      if (isNaN(optionIndex) || optionIndex < 0) {
        console.error("Could not determine valid option index from edge:", edge);
        return;
      }
      
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
      
      // Remove the appropriate target based on the edge type
      let updatedTargets;
      
      if (isSkillCheck) {
        // Remove skill check outcome target (success or failure)
        console.log(`Removing ${isSuccess ? 'success' : 'failure'} target for option ${optionIndex}`);
        updatedTargets = sourceNode.data.options[optionIndex].targets.filter(
          t => !(t.eventId === target && t.isSkillCheckOutcome === true && t.isSuccess === isSuccess)
        );
      } else {
        // Remove regular target
        console.log(`Removing regular target for option ${optionIndex}`);
        updatedTargets = sourceNode.data.options[optionIndex].targets.filter(
          t => t.eventId !== target
        );
      }
      
      console.log("Targets after deletion:", updatedTargets);
      
      // Update the option's targets array
      const updatedOptions = [...sourceNode.data.options];
      updatedOptions[optionIndex] = {
        ...updatedOptions[optionIndex],
        targets: updatedTargets
      };
      
      // If there are remaining targets for normal connections, normalize their probabilities
      if (!isSkillCheck && updatedTargets.length > 0) {
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
    setSelectedEdge(null); // Deselect any edge when selecting a node
  };
  
  // Handle edge selection
  const onEdgeClick = (event, edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null); // Deselect any node when selecting an edge
  };
  
  // Handle node double-click to edit
  const onNodeDoubleClick = (event, node) => {
    setEditingNodeId(node.id);
    setEditingNodeData(node.data);
  };
  
  // Handle click on canvas to deselect
  const onPaneClick = () => {
    setSelectedNode(null);
    setSelectedEdge(null);
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
          options: processedOptions,
          triggerRequirements: event.triggerRequirements || []
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
          return;
        }
        
        // Delete all existing events
        for (const event of allEvents) {
          await deleteEvent(event.id);
        }
      }
      
      // Process and create events
      const importedEvents = [];
      
      // First, create all events without connections
      for (const eventData of data) {
        const {
          id,
          title,
          content,
          position,
          isStarter,
          options,
          optionTargets,
          optionProbabilities,
          optionEffects,
          triggerRequirements
        } = eventData;
        
        // Format options based on the data format
        let formattedOptions = [];
        
        // Case 1: Modern format with options object that includes targets
        if (Array.isArray(options) && options[0] && typeof options[0] === 'object' && 'text' in options[0]) {
          formattedOptions = options.map((opt, index) => {
            // Handle skill check options
            if (opt.skillCheck) {
              const successTargets = opt.successTargets || [];
              const failureTargets = opt.failureTargets || [];
              
              return {
                text: opt.text,
                skillCheck: opt.skillCheck,
                targets: [
                  ...successTargets.map(eventId => ({
                    eventId,
                    isSkillCheckOutcome: true,
                    isSuccess: true,
                    probability: 1
                  })),
                  ...failureTargets.map(eventId => ({
                    eventId,
                    isSkillCheckOutcome: true,
                    isSuccess: false,
                    probability: 1
                  }))
                ],
                effects: opt.effects || []
              };
            } else {
              // Handle regular probability-based options
              const optTargets = opt.optionTargets || [];
              const optProbs = opt.optionProbabilities || [];
              
              return {
                text: opt.text,
                targets: optTargets.map((eventId, i) => ({
                  eventId,
                  probability: optProbs[i] || 1
                })),
                effects: opt.effects || []
              };
            }
          });
        }
        // Case 2: Legacy format with separate optionTargets array
        else if (Array.isArray(options) && Array.isArray(optionTargets)) {
          formattedOptions = options.map((text, index) => {
            const option = {
              text,
              targets: []
            };
            
            // Add targets if available
            if (optionTargets && optionTargets[index]) {
              const targets = Array.isArray(optionTargets[index]) 
                ? optionTargets[index] 
                : [optionTargets[index]];
                
              const probabilities = optionProbabilities && optionProbabilities[index]
                ? (Array.isArray(optionProbabilities[index]) 
                  ? optionProbabilities[index] 
                  : [optionProbabilities[index]])
                : targets.map(() => 1);
                
              option.targets = targets.map((eventId, i) => ({
                eventId,
                probability: probabilities[i] || 1
              }));
              
              // Add effects if available
              const effects = optionEffects && optionEffects[index];
              
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
        else if (Array.isArray(options) && typeof options[0] === 'string') {
          formattedOptions = options.map(text => ({
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
          isStarter: !!isStarter,
          triggerRequirements: triggerRequirements ? triggerRequirements.map(req => {
            // Ensure values have the correct types
            const value = req.value;
            if (typeof value === 'string') {
              // Convert string "true"/"false" to boolean
              if (value.toLowerCase() === 'true') return { ...req, value: true };
              if (value.toLowerCase() === 'false') return { ...req, value: false };
              
              // Convert numeric strings to numbers
              if (!isNaN(value) && value.trim() !== '') {
                return { ...req, value: Number(value) };
              }
            }
            return req;
          }) : []
        });
        
        importedEvents.push(newEvent);
      }
      
      // Reset the file input
      e.target.value = '';
      
      // Refresh the flow
      await loadEvents(storylineId);
      
      alert(`Successfully imported ${importedEvents.length} events!`);
    } catch (error) {
      console.error('Error importing from JSON:', error);
      alert('Failed to import storyline from JSON');
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

  // Delete the selected edge manually
  const deleteSelectedEdge = () => {
    if (!selectedEdge) return;
    
    console.log("Deleting selected edge:", selectedEdge);
    
    try {
      // Call the edge delete function with the selected edge
      onEdgeDelete(selectedEdge);
      
      // Clear the selection
      setSelectedEdge(null);
    } catch (error) {
      console.error("Error deleting edge:", error);
      alert("Failed to delete the connection. Please try again.");
    }
  };

  // Highlight the selected edge 
  useEffect(() => {
    if (selectedEdge) {
      setEdges(eds => 
        eds.map(edge => {
          if (edge.id === selectedEdge.id) {
            // Apply styling to highlight selected edge
            return {
              ...edge,
              style: { 
                strokeWidth: 3,
                stroke: '#FF9800'
              },
              animated: true,
              zIndex: 1000
            };
          } else {
            // Remove any special styling from other edges
            const { style, ...rest } = edge;
            return rest;
          }
        })
      );
    } else {
      // Remove styling from all edges when deselecting
      setEdges(eds => 
        eds.map(edge => {
          const { style, ...rest } = edge;
          return rest;
        })
      );
    }
  }, [selectedEdge, setEdges]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Delete key (Delete or Backspace)
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdge) {
        console.log("Delete key pressed while edge selected");
        event.preventDefault(); // Prevent browser navigation in some browsers
        deleteSelectedEdge();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEdge]); // Only re-run when selectedEdge changes

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
        onEdgeClick={onEdgeClick}
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
        edgesFocusable={true}
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
          
          {/* Edge controls appear when an edge is selected */}
          {selectedEdge && (
            <div className="flow-edge-controls">
              <div className="edge-controls-label">Connection Options</div>
              <div className="edge-info">
                {selectedEdge.id.startsWith('edge-option') ? (
                  <div className="edge-type probability">Probability Connection</div>
                ) : selectedEdge.id.startsWith('edge-success') ? (
                  <div className="edge-type success">Success Path</div>
                ) : selectedEdge.id.startsWith('edge-failure') ? (
                  <div className="edge-type failure">Failure Path</div>
                ) : (
                  <div className="edge-type">Connection</div>
                )}
                <div className="edge-connection">
                  <span className="edge-from">
                    From: {allEvents.find(e => e.id === selectedEdge.source)?.title || 'Unknown'}
                  </span>
                  <span className="edge-arrow">→</span>
                  <span className="edge-to">
                    To: {allEvents.find(e => e.id === selectedEdge.target)?.title || 'Unknown'}
                  </span>
                </div>
                {selectedEdge.label && (
                  <div className="edge-label">
                    {selectedEdge.label}
                  </div>
                )}
              </div>
              <button 
                className="control-btn delete-btn"
                onClick={deleteSelectedEdge}
                title="Delete Connection"
              >
                🗑️ Delete Connection
              </button>
              <div className="edge-help">
                You can also press Delete to remove this connection
              </div>
            </div>
          )}
          
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
                        <li>Each effect has a <code>skill</code> name and <code>value</code></li>
                        <li>Values can be positive or negative to increase or decrease skills</li>
                      </ul>
                    </li>
                    <li><code>triggerRequirements</code>: Array of requirements to access this event
                      <ul>
                        <li>Each requirement has a <code>key</code> and <code>value</code></li>
                        <li>Example: <code>{"{"}"key": "playerLevel", "value": 5{"}"}</code></li>
                        <li>Boolean values should use native <code>true</code>/<code>false</code>, not strings</li>
                        <li>These determine if the event is accessible based on player state</li>
                      </ul>
                    </li>
                    <li><code>position</code>: X,Y coordinates for layout</li>
                    <li><code>isStarter</code>: Set to true for the starting event</li>
                  </ul>
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
        
        .flow-edge-controls {
          background-color: white;
          border-radius: 8px;
          box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
          padding: 12px;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .edge-controls-label {
          font-weight: bold;
          font-size: 14px;
          color: #333;
          margin-bottom: 4px;
        }
        
        .flow-edge-controls .control-btn {
          padding: 6px 12px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          white-space: nowrap;
        }
        
        .flow-edge-controls .delete-btn {
          background-color: #f44336;
          color: white;
        }
        
        .flow-edge-controls .delete-btn:hover {
          background-color: #d32f2f;
        }
        
        .edge-info {
          background-color: #f5f5f5;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 10px;
          font-size: 13px;
        }
        
        .edge-type {
          font-weight: bold;
          margin-bottom: 5px;
          color: #333;
        }
        
        .edge-type.probability {
          color: #2196f3;
        }
        
        .edge-type.success {
          color: #4caf50;
        }
        
        .edge-type.failure {
          color: #f44336;
        }
        
        .edge-connection {
          display: flex;
          align-items: center;
          margin-bottom: 5px;
        }
        
        .edge-arrow {
          margin: 0 8px;
          color: #757575;
        }
        
        .edge-label {
          background-color: #e3f2fd;
          color: #1976d2;
          display: inline-block;
          padding: 3px 8px;
          border-radius: 4px;
          margin-top: 5px;
          font-weight: bold;
        }
        
        .edge-help {
          font-size: 12px;
          color: #757575;
          font-style: italic;
          margin-top: 6px;
        }
        
        .event-node.skill-check-event {
          border-color: #ff9800;
        }
        
        .event-node.trigger-req-event {
          border-color: #8bc34a;
        }
        
        .event-node.skill-check-event.trigger-req-event {
          border: 2px solid;
          border-image: linear-gradient(to right, #ff9800, #8bc34a) 1;
        }
        
        .event-title {
          font-weight: bold;
          padding: 8px;
          border-bottom: 1px solid #ddd;
          position: relative;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: space-between;
        }
        
        .starter-badge {
          background-color: #2196f3;
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 3px;
          white-space: nowrap;
        }
        
        .skill-check-badge {
          background-color: #ff9800;
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 3px;
          white-space: nowrap;
        }
        
        .trigger-req-badge {
          background-color: #8bc34a;
          color: white;
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 3px;
          white-space: nowrap;
        }
        
        .event-content {
          padding: 8px;
          border-bottom: 1px solid #ddd;
        }
        
        .event-trigger-requirements {
          padding: 5px 8px;
          font-size: 11px;
          background-color: #f1f8e9;
          border-bottom: 1px dashed #ddd;
          color: #33691e;
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        
        .trigger-requirement {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .event-options {
          padding: 8px;
          border-bottom: 1px solid #ddd;
        }
      `}</style>
    </div>
  );
};

export default StoryFlow; 