mod types;
mod graph;
mod arduino;
mod espidf;
mod stm32;

pub use types::{GenerateCodeRequest, GenerateCodeResponse};

fn is_stm32(name: &str) -> bool {
    let n = name.to_lowercase();
    n.contains("stm32")
        || n.contains("nucleo")
        || n.contains("f411") || n.contains("f405")
        || n.contains("f103") || n.contains("f401")
        || n.contains("f746") || n.contains("h743")
        || n.contains("l432") || n.contains("l476")
}

fn is_esp32(name: &str) -> bool {
    let n = name.to_lowercase();
    n.contains("esp32") || n.contains("esp-wroom") || n.contains("esp-wrover")
}

fn is_esp8266(name: &str) -> bool {
    name.to_lowercase().contains("esp8266")
}

pub fn generate(req: GenerateCodeRequest) -> Result<GenerateCodeResponse, String> {
    let mut files = vec![];

    for flow in &req.flows {
        if flow.nodes.is_empty() { continue; }

        let hw = req
            .hardware_map
            .mcus
            .iter()
            .find(|m| m.circuit_node_id == flow.mcu_node_id)
            .ok_or_else(|| format!("No hardware entry for MCU {}", flow.mcu_node_id))?;

        let file = if is_stm32(&hw.name) {
            stm32::generate(flow, hw)
        } else if is_esp32(&hw.name) {
            espidf::generate(flow, hw)
        } else if is_esp8266(&hw.name) {
            arduino::generate(flow, hw)
        } else {
            arduino::generate(flow, hw)
        };

        files.push(file);
    }

    Ok(GenerateCodeResponse { files })
}