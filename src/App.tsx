import "reactflow/dist/style.css";

import { useEffect } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";

import { kEdgeTypes } from "./components/Edges";
import { ColorfulMarkerDefinitions } from "./components/Edges/Marker";

const EditWorkFlow = () => {
  const [nodes, _setNodes, onNodesChange] = useNodesState([
    {
      id: '1',
      position: { x: 100, y: 100 },
      data: { label: 'Node 1' },
    },
    {
      id: '2',
      position: { x: 300, y: 100 },
      data: { label: 'Node 2' },
    },
    {
      id: '3',
      position: { x: 200, y: 200 },
      data: { label: 'Node 3' },
    },
  ]);
  
  const [edges, _setEdges, onEdgesChange] = useEdgesState([
    { 
      id: 'e1-2', 
      source: '1', 
      target: '2', 
      type: 'base',
      data: {
        sourcePort: { edges: 2 },
        targetPort: { edges: 1 }
      }
    },
    { 
      id: 'e1-3', 
      source: '1', 
      target: '3', 
      type: 'base',
      data: {
        sourcePort: { edges: 2 },
        targetPort: { edges: 1 }
      }
    },
  ]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <ColorfulMarkerDefinitions />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={kEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Background id="0" color="#ccc" variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap
          pannable
          zoomable
          maskColor="transparent"
          maskStrokeColor="black"
          maskStrokeWidth={10}
        />
      </ReactFlow>
    </div>
  );
};

export const WorkFlow = () => {
  return (
    <ReactFlowProvider>
      <EditWorkFlow />
    </ReactFlowProvider>
  );
};
