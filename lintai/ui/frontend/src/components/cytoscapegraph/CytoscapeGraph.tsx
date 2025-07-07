/* CytoscapeGraph.tsx
   A modern, LR-flow Cytoscape.js renderer with bubble-expand interaction */

   import React, { useEffect, useRef } from 'react';
   import cytoscape, { CssStyleDeclaration, LayoutOptions } from 'cytoscape';
   import dagre from 'cytoscape-dagre';

   // 1️⃣  enable dagre layout plugin
   cytoscape.use(dagre);

   /* ----------  Types  ---------- */
   export interface NodeData {
     data: {
       id: string;
       label: string;          // "caller" | "sink" or any tag you use
       name: string;           // pretty label to display
       value?: string;         // extra
     };
   }

   export interface EdgeData {
     data: {
       id?: string;
       source: string;
       target: string;
     };
   }

   export interface CytoscapeGraphProps {
     nodes: NodeData[];
     edges: EdgeData[];
     /** Override or extend the default visual style */
     styleDefs?: CssStyleDeclaration[];
     /** Override the layout; defaults to LR dagre */
     layout?: LayoutOptions;
   }

   /* ----------  Visual theme  ---------- */
   const modernStyle: CssStyleDeclaration[] = [
     /* base node */
     {
       selector: 'node',
       style: {
         'text-max-width': 120,
         'text-valign': 'center',
         'text-halign': 'center',
         'font-size': 12,
         'font-weight': 600,
         color: '#ffffff',
         'background-color': '#4A90E2',
         'background-fill': 'radial-gradient',
         'background-gradient-stop-colors': '#7BAAF7 #4A90E2',
         'background-gradient-stop-positions': '0 95%',
         shape: 'round-rectangle',
         label: 'data(name)',
         'width': 'label',
         'height': 'label',
         'padding': '10px',
         'text-wrap': 'wrap',
         'shadow-blur': 10,
         'shadow-color': '#000',
         'shadow-opacity': 0.25,
         'transition-property':
           'width height font-size background-color line-color target-arrow-color',
         'transition-duration': '250ms',
       },
     },
     
     /* Component type specific styling */
     { selector: 'node[label="file"]', style: { 'background-color': '#FFD166', 'background-gradient-stop-colors': '#FFE08A #FFD166', 'border-color': '#D9A400', 'border-width': 2 }},
     { selector: 'node[label="function"]', style: { 'background-color': '#4ECDC4', 'background-gradient-stop-colors': '#7EDDD6 #4ECDC4', shape: 'round-rectangle' }},
     { selector: 'node[label="agent"]', style: { 'background-color': '#45B7D1', 'background-gradient-stop-colors': '#6AC5DD #45B7D1', shape: 'round-rectangle' }},
     { selector: 'node[label="multiagent"]', style: { 'background-color': '#96CEB4', 'background-gradient-stop-colors': '#B8D8C7 #96CEB4', shape: 'round-rectangle' }},
     { selector: 'node[label="tool"]', style: { 'background-color': '#FFEAA7', 'background-gradient-stop-colors': '#FFF2C7 #FFEAA7', shape: 'round-rectangle', color: '#2d3436' }},
     { selector: 'node[label="ui"]', style: { 'background-color': '#FD79A8', 'background-gradient-stop-colors': '#FD9EC7 #FD79A8', shape: 'round-rectangle' }},
     { selector: 'node[label="chain"]', style: { 'background-color': '#A29BFE', 'background-gradient-stop-colors': '#BAB5FF #A29BFE', shape: 'round-rectangle' }},
     { selector: 'node[label="lifecycle"]', style: { 'background-color': '#6C5CE7', 'background-gradient-stop-colors': '#8B7EEA #6C5CE7', shape: 'round-rectangle' }},
     { selector: 'node[label="sink"]', style: { 'background-color': '#FF6B6B', 'background-gradient-stop-colors': '#FF9C9C #FF6B6B', shape: 'round-rectangle' }},
     { selector: 'node[label="external"]', style: { 'background-color': '#E17055', 'background-gradient-stop-colors': '#E88A7A #E17055', shape: 'round-rectangle' }},
     
     /* Compound node styling (bounding box for file) */
     { 
       selector: 'node:parent', 
       style: {
         'background-color': '#f8f9fa',
         'background-opacity': 0.8,
         'border-color': '#dee2e6',
         'border-width': 2,
         'border-style': 'dashed',
         'text-valign': 'top',
         'text-halign': 'center',
         'font-size': 14,
         'font-weight': 'bold',
         'color': '#495057',
         'padding': 20,
         'shape': 'round-rectangle',
         'min-width': 200,
         'min-height': 150
       }
     },
     /* edges */
     {
       selector: 'edge',
       style: {
         width: 2,
         opacity: 0.75,
         'line-color': '#B3B3B3',
         'curve-style': 'bezier',
         'target-arrow-shape': 'triangle',
         'target-arrow-color': '#B3B3B3',
         'arrow-scale': 1.3,
         'transition-property': 'width line-color target-arrow-color opacity',
         'transition-duration': '200ms',
         label: 'data(label)',
         'font-size': 10,
         'font-weight': 'normal',
         'text-rotation': 'autorotate',
         'text-margin-y': -10,
         'text-background-color': '#ffffff',
         'text-background-opacity': 0.8,
         'text-background-padding': 2,
         'text-border-color': '#cccccc',
         'text-border-width': 1,
         'text-border-opacity': 0.5,
         color: '#333333',
       },
     },
     /* highlight class (applied on expand) */
     {
       selector: '.highlighted',
       style: {
         'line-color': '#FF851B',
         'target-arrow-color': '#FF851B',
         width: 4,
       },
     },
     /* expanded node tint */
     {
       selector: 'node.expanded',
       style: {
         'background-color': '#2ECC40',
         'background-gradient-stop-colors': '#5CEB6B #2ECC40',
       },
     },
   ];

   /* ----------  Default LR dagre layout  ---------- */
   const horizontalDagre: any = {
     name: 'dagre',
     rankDir: 'TB', // flow Left ➜ Right
     nodeSep: 50,   // horizontal spacing
     rankSep: 90,   // vertical spacing
     edgeSep: 15,
     animate: true,
     fit: true,
     padding: 20,
   };

   /* ----------  Component  ---------- */
   export const CytoscapeGraph: React.FC<CytoscapeGraphProps> = ({
     nodes,
     edges,
     styleDefs,
     layout,
   }) => {
     const containerRef = useRef<HTMLDivElement>(null);

     useEffect(() => {
       if (!containerRef.current) return;

       console.log('CytoscapeGraph nodes:', nodes);
       console.log('CytoscapeGraph edges:', edges);

       const cy = cytoscape({
         container: containerRef.current,
         elements: [...nodes, ...edges],
         style: styleDefs || modernStyle,
         layout: layout || horizontalDagre,
         wheelSensitivity: 0.2,
         userZoomingEnabled: true,
         userPanningEnabled: true,
         boxSelectionEnabled: false,
       });

       /* --- bubble-expand / collapse behaviour --- */
       cy.on('tap', 'node', (evt) => {
         const node = evt.target;
         const expanded = Boolean(node.data('expanded'));

         // remember original size once
         const baseW = node.data('baseW') ?? node.width();
         const baseH = node.data('baseH') ?? node.height();
         if (node.data('baseW') == null) node.data({ baseW, baseH });

         if (expanded) {
           /* collapse */
           node.animate(
             { style: { width: baseW, height: baseH, 'font-size': 12 } },
             { duration: 220 }
           );
           node.removeClass('expanded').data('expanded', false);
           node.connectedEdges().removeClass('highlighted');
         } else {
           /* expand */
           node.animate(
             {
               style: {
                 width: baseW * 1.7,
                 height: baseH * 1.7,
                 'font-size': 16,
               },
             },
             { duration: 220 }
           );
           node.addClass('expanded').data('expanded', true);
           node.connectedEdges().addClass('highlighted');
         }

         /* re-run dagre so neighbours slide out of the way */
         cy.layout(layout || horizontalDagre).run();
       });

       /* cleanup on unmount */
       return () => cy.destroy();
     }, [nodes, edges, styleDefs, layout]);

     return <div ref={containerRef} className="w-full h-full " />;
   };

   export default CytoscapeGraph;
