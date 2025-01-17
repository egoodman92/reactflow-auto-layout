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
import { kNodeTypes } from "./components/Nodes";
import { ReactflowInstance } from "./components/ReactflowInstance";
import defaultWorkflow from "./data/data.json";
import { workflow2reactflow } from "./data/convert";
import { kDefaultLayoutConfig, ReactflowLayoutConfig } from "./layout/node";
import { useAutoLayout } from "./layout/useAutoLayout";

const EditWorkFlow = () => {
  const [nodes, _setNodes, onNodesChange] = useNodesState([]);
  const [edges, _setEdges, onEdgesChange] = useEdgesState([]);

  const { layout, layouting } = useAutoLayout();


  useEffect(() => {
    const { nodes, edges } = workflow2reactflow(defaultWorkflow as any);
    console.log({ nodes, edges });
    layout({ nodes, edges, ...kDefaultLayoutConfig });
  }, []);

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={kNodeTypes}
        edgeTypes={kEdgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
      >
        <Background id="0" color="#ccc" variant={BackgroundVariant.Dots} />
        <ReactflowInstance />
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