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
         'width': 'label',     // 👈 auto-size to label
         'height': 'label',
         'padding': '10px',
         'text-wrap': 'wrap',  // keep
         'shadow-blur': 10,
         'shadow-color': '#000',
         'shadow-opacity': 0.25,
         'transition-property':
           'width height font-size background-color line-color target-arrow-color',
         'transition-duration': '250ms',
       },
     },
     /* sinks look different */
     {
       selector: 'node[label = "sink"]',
       style: {
         'background-color': '#FF6B6B',
         'background-gradient-stop-colors': '#FF9C9C #FF6B6B',
         shape: "round-rectangle"
              },
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
   const horizontalDagre: LayoutOptions = {
     name: 'dagre',
     rankDir: 'LR', // flow Left ➜ Right
     nodeSep: 50,   // horizontal spacing
     rankSep: 90,   // vertical spacing
     edgeSep: 15,
     animate: true,
     fit: true,
     padding: 0,
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

       const cy = cytoscape({
         container: containerRef.current,
         elements: [...nodes, ...edges],
         style: styleDefs || modernStyle,
         layout: layout || horizontalDagre,
         wheelSensitivity: 0.2,
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

     return <div ref={containerRef} className="w-full h-full bg-neutral-950" />;
   };

   export default CytoscapeGraph;
