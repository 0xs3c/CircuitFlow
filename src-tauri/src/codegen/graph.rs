use std::collections::HashMap;
use crate::codegen::types::{FlowEdge, FlowNode, LogicNodeData};

pub struct FlowGraph<'a> {
    pub nodes: &'a [FlowNode],
    node_map: HashMap<String, &'a FlowNode>,
    adjacency: HashMap<String, Vec<(String, String)>>,
}

impl<'a> FlowGraph<'a> {
    pub fn new(nodes: &'a [FlowNode], edges: &'a [FlowEdge]) -> Self {
        let mut node_map = HashMap::new();
        let mut adjacency: HashMap<String, Vec<(String, String)>> = HashMap::new();

        for node in nodes {
            node_map.insert(node.id.clone(), node);
            adjacency.entry(node.id.clone()).or_default();
        }

        for edge in edges {
            let handle = edge.source_handle.clone().unwrap_or_else(|| "out".to_string());
            adjacency
                .entry(edge.source.clone())
                .or_default()
                .push((edge.target.clone(), handle));
        }

        Self { nodes, node_map, adjacency }
    }

    pub fn next(&self, node_id: &str, handle: &str) -> Option<&FlowNode> {
        self.adjacency
            .get(node_id)?
            .iter()
            .find(|(_, h)| h == handle)
            .and_then(|(target_id, _)| self.node_map.get(target_id).copied())
    }

    pub fn triggers(&self) -> Vec<&FlowNode> {
        self.nodes
            .iter()
            .filter(|n| {
                matches!(
                    &n.data,
                    LogicNodeData::OnStart { .. }
                        | LogicNodeData::OnLoop { .. }
                        | LogicNodeData::OnTimer { .. }
                        | LogicNodeData::OnInterrupt { .. }
                )
            })
            .collect()
    }
}