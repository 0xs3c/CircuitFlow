use std::collections::{HashMap, HashSet};
use crate::codegen::types::*;
use crate::codegen::graph::FlowGraph;

struct Code {
    lines: Vec<String>,
    indent: usize,
}

impl Code {
    fn new() -> Self { Self { lines: vec![], indent: 0 } }
    fn ln(&mut self, s: &str) {
        let pad = "  ".repeat(self.indent);
        self.lines.push(format!("{}{}", pad, s));
    }
    fn blank(&mut self) { self.lines.push(String::new()); }
    fn push(&mut self) { self.indent += 1; }
    fn pop(&mut self) { if self.indent > 0 { self.indent -= 1; } }
    fn build(self) -> String { self.lines.join("\n") }
}

fn parse_stm32_pin(pin_name: &str) -> (String, String) {
    let clean = pin_name.split('/').next().unwrap_or(pin_name).trim();
    if clean.len() >= 3 && clean.starts_with('P') {
        let port_char = clean.chars().nth(1).unwrap_or('A').to_uppercase().next().unwrap_or('A');
        let pin_num_str: String = clean.chars().skip(2).collect();
        let pin_num = pin_num_str.parse::<u32>().unwrap_or(0);
        return (
            format!("GPIO{}", port_char),
            format!("GPIO_PIN_{}", pin_num),
        );
    }
    ("GPIOA".to_string(), "GPIO_PIN_0".to_string())
}

fn sanitize(s: &str) -> String {
    s.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect()
}

fn infer_var_type(name: &str) -> &'static str {
    let l = name.to_lowercase();
    if l.contains("state") || l.contains("flag") { "uint8_t" }
    else if l.contains("data") || l.contains("received") { "char*" }
    else if l.contains("count") || l.contains("index") { "int" }
    else { "float" }
}

fn collect_globals(flow: &LogicFlow, hw: &McuHardware) -> Vec<String> {
    let mut globals = vec![];
    let mut declared: HashSet<String> = HashSet::new();

    // UART handle if used
    let uses_uart = flow.nodes.iter().any(|n| {
        matches!(&n.data, LogicNodeData::SendUart { .. } | LogicNodeData::ReceiveUart { .. })
    });
    if uses_uart {
        globals.push("extern UART_HandleTypeDef huart1;".to_string());
    }

    // Variables
    for node in &flow.nodes {
        let (var_name, var_type): (Option<&str>, Option<&str>) = match &node.data {
            LogicNodeData::ReadSensor { output_variable, .. } => (Some(output_variable), Some("float")),
            LogicNodeData::ReadPin    { output_variable, .. } => (Some(output_variable), Some("uint8_t")),
            LogicNodeData::ReceiveUart{ output_variable, .. } => (Some(output_variable), Some("char")),
            LogicNodeData::SetVariable{ variable_name, .. }   => (Some(variable_name), None),
            _ => (None, None),
        };
        if let Some(name) = var_name {
            if !name.is_empty() && declared.insert(name.to_string()) {
                let t = var_type.unwrap_or_else(|| infer_var_type(name));
                let default = if t == "char" {
                    globals.push(format!("{} {}[64] = {{}};", t, name));
                    continue;
                } else if t == "float" { "0.0f" } else { "0" };
                globals.push(format!("{} {} = {};", t, name, default));
            }
        }
    }

    let _ = hw;
    globals
}

fn collect_gpio_inits(flow: &LogicFlow) -> (Vec<String>, Vec<String>) {
    let mut port_clocks: HashSet<String> = HashSet::new();
    let mut pin_inits: Vec<String> = vec![];

    for node in &flow.nodes {
        match &node.data {
            LogicNodeData::SetPin { mcu_pin_name, .. } => {
                let (port, pin) = parse_stm32_pin(mcu_pin_name);
                port_clocks.insert(port.clone());
                pin_inits.push(format!(
                    "  GPIO_InitStruct.Pin = {};\n  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;\n  GPIO_InitStruct.Pull = GPIO_NOPULL;\n  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;\n  HAL_GPIO_Init({}, &GPIO_InitStruct);\n",
                    pin, port
                ));
            }
            LogicNodeData::ReadPin { mcu_pin_name, .. } => {
                let (port, pin) = parse_stm32_pin(mcu_pin_name);
                port_clocks.insert(port.clone());
                pin_inits.push(format!(
                    "  GPIO_InitStruct.Pin = {};\n  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;\n  GPIO_InitStruct.Pull = GPIO_PULLUP;\n  HAL_GPIO_Init({}, &GPIO_InitStruct);\n",
                    pin, port
                ));
            }
            _ => {}
        }
    }

    let clocks: Vec<String> = port_clocks
        .iter()
        .map(|p| format!("  __HAL_RCC_{}_CLK_ENABLE();", p))
        .collect();

    (clocks, pin_inits)
}

fn gen_node(
    node: &FlowNode,
    graph: &FlowGraph,
    hw: &McuHardware,
    code: &mut Code,
    visited: &mut HashSet<String>,
) {
    if visited.contains(&node.id) { return; }
    visited.insert(node.id.clone());

    match &node.data {
        LogicNodeData::OnStart { .. } | LogicNodeData::OnLoop { .. } => {}

        LogicNodeData::ReadSensor { component_node_id, read_property, output_variable, .. } => {
            let comp = hw.wired_components.iter().find(|c| &c.circuit_node_id == component_node_id);
            if let Some(comp) = comp {
                let name = comp.name.to_lowercase();
                if name.contains("dht") {
                    code.ln(&format!(
                        "/* DHT read — requires bit-bang library */"));
                    code.ln(&format!("{} = DHT_Read{}();", output_variable,
                        if read_property == "humidity" { "Humidity" } else { "Temperature" }));
                } else {
                    code.ln(&format!(
                        "/* Read {} from {} via {} */",
                        read_property, comp.name,
                        comp.protocols.join("/")
                    ));
                    code.ln(&format!("{} = 0.0f; /* implement read here */", output_variable));
                }
            }
        }

        LogicNodeData::ReadPin { mcu_pin_name, output_variable, .. } => {
            let (port, pin) = parse_stm32_pin(mcu_pin_name);
            code.ln(&format!(
                "{} = (HAL_GPIO_ReadPin({}, {}) == GPIO_PIN_SET) ? 1 : 0;",
                output_variable, port, pin
            ));
        }

        LogicNodeData::Condition { variable_name, operator, compare_value, .. } => {
            code.ln(&format!("if ({} {} {}) {{", variable_name, operator, compare_value));
            code.push();
            if let Some(yes) = graph.next(&node.id, "yes") {
                gen_node(yes, graph, hw, code, &mut visited.clone());
            }
            code.pop();
            code.ln("} else {");
            code.push();
            if let Some(no) = graph.next(&node.id, "no") {
                gen_node(no, graph, hw, code, &mut visited.clone());
            }
            code.pop();
            code.ln("}");
            return;
        }

        LogicNodeData::Wait { duration_ms, .. } => {
            code.ln(&format!("HAL_Delay({});", duration_ms));
        }

        LogicNodeData::LoopCount { count, .. } => {
            code.ln(&format!("for (int _i = 0; _i < {}; _i++) {{", count));
            code.push();
            if let Some(next) = graph.next(&node.id, "out") {
                gen_node(next, graph, hw, code, &mut visited.clone());
            }
            code.pop();
            code.ln("}");
            return;
        }

        LogicNodeData::LoopWhile { variable_name, operator, compare_value, .. } => {
            code.ln(&format!("while ({} {} {}) {{", variable_name, operator, compare_value));
            code.push();
            if let Some(next) = graph.next(&node.id, "out") {
                gen_node(next, graph, hw, code, &mut visited.clone());
            }
            code.pop();
            code.ln("}");
            return;
        }

        LogicNodeData::SetVariable { variable_name, raw_value, .. } => {
            code.ln(&format!("{} = {};", variable_name, raw_value));
        }

        LogicNodeData::SetPin { mcu_pin_name, state, .. } => {
            let (port, pin) = parse_stm32_pin(mcu_pin_name);
            match state.as_str() {
                "HIGH"   => code.ln(&format!("HAL_GPIO_WritePin({}, {}, GPIO_PIN_SET);", port, pin)),
                "LOW"    => code.ln(&format!("HAL_GPIO_WritePin({}, {}, GPIO_PIN_RESET);", port, pin)),
                "TOGGLE" => code.ln(&format!("HAL_GPIO_TogglePin({}, {});", port, pin)),
                _        => code.ln(&format!("HAL_GPIO_WritePin({}, {}, GPIO_PIN_SET);", port, pin)),
            }
        }

        LogicNodeData::WriteComponent { component_node_id, action, raw_value, .. } => {
            let comp = hw.wired_components.iter().find(|c| &c.circuit_node_id == component_node_id);
            if let Some(comp) = comp {
                code.ln(&format!("/* {} {} on {} */", action, raw_value, comp.name));
            }
        }

        LogicNodeData::SendUart { data_template, .. } => {
            let msg = format!("{}\\r\\n", data_template);
            code.ln(&format!(
                "HAL_UART_Transmit(&huart1, (uint8_t*)\"{}\", {}, HAL_MAX_DELAY);",
                msg, msg.len()
            ));
        }

        LogicNodeData::ReceiveUart { output_variable, .. } => {
            code.ln(&format!(
                "HAL_UART_Receive(&huart1, (uint8_t*){}, 63, 1000);",
                output_variable
            ));
        }

        LogicNodeData::OnTimer { .. }
        | LogicNodeData::OnInterrupt { .. } => {}
    }

    if let Some(next) = graph.next(&node.id, "out") {
        gen_node(next, graph, hw, code, visited);
    }
}

pub fn generate(flow: &LogicFlow, hw: &McuHardware) -> GeneratedFile {
    let graph   = FlowGraph::new(&flow.nodes, &flow.edges);
    let globals = collect_globals(flow, hw);
    let (clocks, pin_inits) = collect_gpio_inits(flow);

    let mut main_init  = Code::new();
    let mut main_loop  = Code::new();

    for trigger in graph.triggers() {
        let mut visited = HashSet::new();
        match &trigger.data {
            LogicNodeData::OnStart { .. } => {
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut main_init, &mut visited);
                }
            }
            LogicNodeData::OnLoop { .. } => {
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut main_loop, &mut visited);
                }
            }
            _ => {}
        }
    }

    let mut out = Code::new();

    out.ln(&format!("/* {} — generated by CircuitFlow */", hw.instance_label));
    out.ln("/* Add this file to your STM32CubeIDE project */");
    out.blank();
    out.ln("#include \"main.h\"");
    out.ln("#include <stdio.h>");
    out.ln("#include <string.h>");
    out.blank();

    for g in &globals { out.ln(g); }
    out.blank();

    out.ln("static void MX_GPIO_Init(void) {");
    out.ln("  GPIO_InitTypeDef GPIO_InitStruct = {0};");
    for ck in &clocks { out.ln(ck); }
    for pi in &pin_inits { for l in pi.lines() { out.ln(l); } }
    out.ln("}");
    out.blank();

    out.ln("int main(void) {");
    out.push();
    out.ln("HAL_Init();");
    out.ln("SystemClock_Config();");
    out.ln("MX_GPIO_Init();");
    out.blank();

    let init_str = main_init.build();
    if !init_str.trim().is_empty() {
        out.ln("/* Startup */");
        for l in init_str.lines() { out.ln(l); }
        out.blank();
    }

    out.ln("while (1) {");
    out.push();
    let loop_str = main_loop.build();
    if loop_str.trim().is_empty() {
        out.ln("/* Add an On Loop node in the Logic tab */");
    } else {
        for l in loop_str.lines() { out.ln(l); }
    }
    out.pop();
    out.ln("}");
    out.pop();
    out.ln("}");

    GeneratedFile {
        mcu_name: hw.instance_label.clone(),
        platform: "STM32 HAL".to_string(),
        filename: "main.c".to_string(),
        content: out.build(),
    }
}