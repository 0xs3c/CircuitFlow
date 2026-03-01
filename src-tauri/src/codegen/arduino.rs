use std::collections::{HashMap, HashSet};
use crate::codegen::types::*;
use crate::codegen::graph::FlowGraph;

// ── Code builder ──────────────────────────────────────────────────────────────

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

// ── Pin helpers ───────────────────────────────────────────────────────────────

fn esp32_pin_num(pin_id: &str, pin_name: &str) -> String {
    for s in [pin_id, pin_name] {
        let lower = s.to_lowercase();
        let stripped = lower
            .trim_start_matches("gpio")
            .split('/')
            .next()
            .unwrap_or(s);
        if let Ok(n) = stripped.parse::<u32>() {
            return n.to_string();
        }
    }
    pin_id.to_string()
}

fn sanitize(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
}

// ── Sensor helpers ────────────────────────────────────────────────────────────

fn sensor_obj(comp: &WiredComponent) -> String {
    format!("sensor_{}", sanitize(&comp.circuit_node_id))
}

fn sensor_read_expr(comp: &WiredComponent, property: &str) -> String {
    let name = comp.name.to_lowercase();
    let obj = sensor_obj(comp);

    if name.contains("dht") {
        return match property {
            "humidity"    => format!("{}.readHumidity()", obj),
            _             => format!("{}.readTemperature()", obj),
        };
    }
    if name.contains("bmp280") || name.contains("bme280") {
        return match property {
            "pressure"    => format!("{}.readPressure() / 100.0F", obj),
            "altitude"    => format!("{}.readAltitude(1013.25)", obj),
            _             => format!("{}.readTemperature()", obj),
        };
    }
    if comp.category == "GPS" {
        return match property {
            "latitude"    => format!("{}.location.lat()", obj),
            "longitude"   => format!("{}.location.lng()", obj),
            "altitude"    => format!("{}.altitude.meters()", obj),
            "speed"       => format!("{}.speed.kmph()", obj),
            _             => format!("{}.hdop.value()", obj),
        };
    }

    // Generic: use first connection pin as analog read
    let pin = comp
        .connections
        .first()
        .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
        .unwrap_or_else(|| "A0".to_string());
    format!("analogRead({})", pin)
}

fn write_component_expr(comp: &WiredComponent, action: &str, value: &str) -> String {
    let name = comp.name.to_lowercase();
    let obj = sensor_obj(comp);

    if name.contains("esc") || comp.category == "ESC" {
        return match action {
            "set_throttle" => format!("{}.writeMicroseconds({})", obj, value),
            "arm"          => format!("{}.writeMicroseconds(1000)", obj),
            "disarm"       => format!("{}.writeMicroseconds(900)", obj),
            _              => format!("{}.write({})", obj, value),
        };
    }
    if comp.category == "Display" {
        return match action {
            "print_text"   => format!("{}.print({})", obj, value),
            "clear"        => format!("{}.clearDisplay()", obj),
            _              => format!("{}.println({})", obj, value),
        };
    }

    format!("// write_component: {}.{}({})", obj, action, value)
}

fn infer_var_type(name: &str) -> &'static str {
    let l = name.to_lowercase();
    if l.contains("state") || l.contains("flag") || l.contains("active") || l.contains("enabled") {
        "bool"
    } else if l.contains("data") || l.contains("msg") || l.contains("received") || l.contains("text") {
        "String"
    } else if l.contains("count") || l.contains("index") || l.contains("num") {
        "int"
    } else {
        "float"
    }
}

// ── Includes ──────────────────────────────────────────────────────────────────

fn collect_includes(flow: &LogicFlow, hw: &McuHardware) -> Vec<String> {
    let mut inc: Vec<String> = vec!["#include <Arduino.h>".to_string()];
    let mut added: HashSet<String> = HashSet::new();

    let mut add = |s: &str| {
        if added.insert(s.to_string()) {
            inc.push(format!("#include <{}>", s));
        }
    };

    for comp in &hw.wired_components {
        let name = comp.name.to_lowercase();
        if name.contains("dht22") || name.contains("dht11") { add("DHT.h"); }
        if name.contains("bmp280") || name.contains("bme280") { add("Adafruit_BMP280.h"); }
        if comp.category == "GPS" { add("TinyGPSPlus.h"); add("SoftwareSerial.h"); }
        if comp.category == "ESC" { add("Servo.h"); }
        if comp.category == "Display" { add("Adafruit_SSD1306.h"); add("Wire.h"); }
        if comp.protocols.iter().any(|p| p == "I2C") { add("Wire.h"); }
        if comp.protocols.iter().any(|p| p == "SPI") { add("SPI.h"); }
    }

    for node in &flow.nodes {
        if matches!(&node.data, LogicNodeData::SendUart { .. } | LogicNodeData::ReceiveUart { .. }) {
            // Serial is built-in, no include needed
        }
    }

    inc
}

// ── Global declarations ───────────────────────────────────────────────────────

fn collect_globals(flow: &LogicFlow, hw: &McuHardware) -> Vec<String> {
    let mut globals: Vec<String> = vec![];

    // Sensor objects
    for comp in &hw.wired_components {
        let name = comp.name.to_lowercase();
        let obj = sensor_obj(comp);
        let pin = comp
            .connections
            .first()
            .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
            .unwrap_or_else(|| "4".to_string());

        if name.contains("dht22") {
            globals.push(format!("DHT {}({}, DHT22);", obj, pin));
        } else if name.contains("dht11") {
            globals.push(format!("DHT {}({}, DHT11);", obj, pin));
        } else if name.contains("bmp280") {
            globals.push(format!("Adafruit_BMP280 {};", obj));
        } else if name.contains("bme280") {
            globals.push(format!("Adafruit_BME280 {};", obj));
        } else if comp.category == "GPS" {
            globals.push(format!("TinyGPSPlus {};", obj));
        } else if comp.category == "ESC" {
            globals.push(format!("Servo {};", obj));
        }
    }

    if !globals.is_empty() {
        globals.push(String::new());
    }

    // Variables declared in flow
    let mut declared: HashSet<String> = HashSet::new();
    for node in &flow.nodes {
        let (var_name, var_type): (Option<&str>, Option<&str>) = match &node.data {
            LogicNodeData::ReadSensor { output_variable, .. } => {
                (Some(output_variable.as_str()), None)
            }
            LogicNodeData::ReadPin { output_variable, .. } => {
                (Some(output_variable.as_str()), Some("bool"))
            }
            LogicNodeData::ReceiveUart { output_variable, .. } => {
                (Some(output_variable.as_str()), Some("String"))
            }
            LogicNodeData::SetVariable { variable_name, .. } => {
                (Some(variable_name.as_str()), None)
            }
            _ => (None, None),
        };
        if let Some(name) = var_name {
            if !name.is_empty() && declared.insert(name.to_string()) {
                let t = var_type.unwrap_or_else(|| infer_var_type(name));
                let default = match t {
                    "bool"   => "false",
                    "String" => "\"\"",
                    "int"    => "0",
                    _        => "0.0",
                };
                globals.push(format!("{} {} = {};", t, name, default));
            }
        }
    }

    // Timer state variables for on_timer nodes
    for node in &flow.nodes {
        if let LogicNodeData::OnTimer { .. } = &node.data {
            globals.push(format!(
                "unsigned long _timer_{}_last = 0;",
                sanitize(&node.id)
            ));
        }
    }

    globals
}

// ── Node code generation ──────────────────────────────────────────────────────

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
        LogicNodeData::OnStart { .. } | LogicNodeData::OnLoop { .. } => {
            // Trigger nodes — just follow the chain
        }

        LogicNodeData::OnTimer { interval_ms, .. } => {
            let timer_var = format!("_timer_{}_last", sanitize(&node.id));
            code.ln(&format!(
                "if (millis() - {} >= {}UL) {{",
                timer_var, interval_ms
            ));
            code.push();
            code.ln(&format!("{} = millis();", timer_var));
            if let Some(next) = graph.next(&node.id, "out") {
                gen_node(next, graph, hw, code, visited);
            }
            code.pop();
            code.ln("}");
            return;
        }

        LogicNodeData::ReadSensor { component_node_id, read_property, output_variable, .. } => {
            if let Some(comp) = hw.wired_components.iter().find(|c| &c.circuit_node_id == component_node_id) {
                let expr = sensor_read_expr(comp, read_property);
                code.ln(&format!("{} = {};", output_variable, expr));
            } else {
                code.ln(&format!("// read_sensor: component not found ({})", component_node_id));
            }
        }

        LogicNodeData::ReadPin { mcu_pin_id, mcu_pin_name, output_variable, .. } => {
            let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
            code.ln(&format!("{} = digitalRead({});", output_variable, pin));
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
            code.ln(&format!("delay({});", duration_ms));
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

        LogicNodeData::SetVariable { variable_name, value_source, raw_value, .. } => {
            let _ = value_source;
            code.ln(&format!("{} = {};", variable_name, raw_value));
        }

        LogicNodeData::SetPin { mcu_pin_id, mcu_pin_name, state, .. } => {
            let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
            match state.as_str() {
                "HIGH"   => code.ln(&format!("digitalWrite({}, HIGH);", pin)),
                "LOW"    => code.ln(&format!("digitalWrite({}, LOW);", pin)),
                "TOGGLE" => code.ln(&format!("digitalWrite({}, !digitalRead({}));", pin, pin)),
                _        => code.ln(&format!("digitalWrite({}, HIGH);", pin)),
            }
        }

        LogicNodeData::WriteComponent { component_node_id, action, value_source, raw_value, .. } => {
            if let Some(comp) = hw.wired_components.iter().find(|c| &c.circuit_node_id == component_node_id) {
                let value = if value_source == "variable" { raw_value.as_str() } else { raw_value.as_str() };
                code.ln(&format!("{};", write_component_expr(comp, action, value)));
            }
        }

        LogicNodeData::SendUart { data_template, .. } => {
            let escaped = data_template.replace('{', "\" + String(").replace('}', ") + \"");
            code.ln(&format!("Serial.println(\"{}\" );", escaped));
        }

        LogicNodeData::ReceiveUart { output_variable, .. } => {
            code.ln("if (Serial.available()) {");
            code.push();
            code.ln(&format!("{} = Serial.readStringUntil('\\n');", output_variable));
            code.pop();
            code.ln("}");
        }

        LogicNodeData::OnInterrupt { .. } => {
            // ISR bodies are generated separately
        }
    }

    // Follow next node
    if let Some(next) = graph.next(&node.id, "out") {
        gen_node(next, graph, hw, code, visited);
    }
}

// ── Setup / loop bodies ───────────────────────────────────────────────────────

fn gen_setup_init(hw: &McuHardware, all_pins: &HashMap<String, &str>) -> Vec<String> {
    let mut lines = vec![];
    lines.push("  Serial.begin(115200);".to_string());

    for comp in &hw.wired_components {
        let name = comp.name.to_lowercase();
        let obj = sensor_obj(comp);
        if name.contains("dht") {
            lines.push(format!("  {}.begin();", obj));
        } else if name.contains("bmp280") || name.contains("bme280") {
            lines.push(format!("  {}.begin();", obj));
        } else if comp.category == "GPS" {
            lines.push("  Serial2.begin(9600);".to_string());
        }
        if comp.protocols.iter().any(|p| p == "I2C") {
            if !lines.iter().any(|l: &String| l.contains("Wire.begin")) {
                lines.push("  Wire.begin();".to_string());
            }
        }
    }

    for (pin, mode) in all_pins {
        lines.push(format!("  pinMode({}, {});", pin, mode));
    }

    lines
}

fn collect_pin_modes(flow: &LogicFlow) -> HashMap<String, &'static str> {
    let mut pins = HashMap::new();
    for node in &flow.nodes {
        match &node.data {
            LogicNodeData::SetPin { mcu_pin_id, mcu_pin_name, .. } => {
                let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
                pins.insert(pin, "OUTPUT");
            }
            LogicNodeData::ReadPin { mcu_pin_id, mcu_pin_name, .. } => {
                let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
                pins.entry(pin).or_insert("INPUT");
            }
            _ => {}
        }
    }
    pins
}

// ── Main entry ────────────────────────────────────────────────────────────────

pub fn generate(flow: &LogicFlow, hw: &McuHardware) -> GeneratedFile {
    let graph = FlowGraph::new(&flow.nodes, &flow.edges);
    let triggers = graph.triggers();

    let includes = collect_includes(flow, hw);
    let globals  = collect_globals(flow, hw);
    let pin_modes = collect_pin_modes(flow);
    let init_lines = gen_setup_init(hw, &pin_modes);

    let mut setup_code = Code::new();
    let mut loop_code  = Code::new();
    let mut isr_code   = Code::new();

    for trigger in &triggers {
        let mut visited = HashSet::new();
        match &trigger.data {
            LogicNodeData::OnStart { .. } => {
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut setup_code, &mut visited);
                }
            }
            LogicNodeData::OnLoop { .. } => {
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut loop_code, &mut visited);
                }
            }
            LogicNodeData::OnTimer { .. } => {
                gen_node(trigger, &graph, hw, &mut loop_code, &mut visited);
            }
            LogicNodeData::OnInterrupt { mcu_pin_id, mcu_pin_name, trigger: edge, .. } => {
                let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
                let isr_name = format!("ISR_{}", sanitize(&trigger.id));
                isr_code.ln(&format!("void IRAM_ATTR {}() {{", isr_name));
                isr_code.push();
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut isr_code, &mut visited);
                }
                isr_code.pop();
                isr_code.ln("}");
                isr_code.blank();

                let mode = match edge.as_str() {
                    "rising"  => "RISING",
                    "falling" => "FALLING",
                    _         => "CHANGE",
                };
                setup_code.ln(&format!(
                    "attachInterrupt(digitalPinToInterrupt({}), {}, {});",
                    pin, isr_name, mode
                ));
            }
            _ => {}
        }
    }

    let mut out = Code::new();

    out.ln(&format!("/* {} — generated by CircuitFlow */", hw.instance_label));
    out.blank();

    for inc in &includes { out.ln(inc); }
    out.blank();

    for g in &globals { out.ln(g); }
    out.blank();

    // Forward-declare ISRs if any
    let isr_str = isr_code.build();
    if !isr_str.trim().is_empty() {
        for line in isr_str.lines() { out.ln(line); }
        out.blank();
    }

    // setup()
    out.ln("void setup() {");
    for line in &init_lines { out.ln(line); }
    let setup_str = setup_code.build();
    if !setup_str.trim().is_empty() {
        out.blank();
        for line in setup_str.lines() { out.ln(&format!("  {}", line)); }
    }
    out.ln("}");
    out.blank();

    // loop()
    out.ln("void loop() {");
    let loop_str = loop_code.build();
    if loop_str.trim().is_empty() {
        out.ln("  // Add an On Loop node in the Logic tab");
    } else {
        for line in loop_str.lines() { out.ln(&format!("  {}", line)); }
    }
    out.ln("}");

    let mcu_lower = hw.name.to_lowercase();
    let platform = if mcu_lower.contains("esp32") { "ESP32 (Arduino)" }
        else if mcu_lower.contains("esp8266") { "ESP8266 (Arduino)" }
        else { "Arduino" };

    GeneratedFile {
        mcu_name: hw.instance_label.clone(),
        platform: platform.to_string(),
        filename: "main.ino".to_string(),
        content: out.build(),
    }
}