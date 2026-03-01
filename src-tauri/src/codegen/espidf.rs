use std::collections::HashSet;
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

fn sanitize(s: &str) -> String {
    s.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect()
}

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

fn infer_var_type(name: &str) -> &'static str {
    let l = name.to_lowercase();
    if l.contains("state") || l.contains("flag") || l.contains("active") { "bool" }
    else if l.contains("data") || l.contains("msg") || l.contains("received") { "char*" }
    else if l.contains("count") || l.contains("index") || l.contains("num") { "int" }
    else { "float" }
}

fn sensor_read_expr(comp: &WiredComponent, property: &str) -> String {
    let name = comp.name.to_lowercase();
    let pin = comp
        .connections
        .first()
        .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
        .unwrap_or_else(|| "4".to_string());

    if name.contains("dht") {
        return format!("dht_read_{}({})", property, pin);
    }
    if name.contains("bmp280") || name.contains("bme280") {
        return match property {
            "pressure"    => "bmp280_read_pressure()".to_string(),
            "altitude"    => "bmp280_read_altitude()".to_string(),
            _             => "bmp280_read_temperature()".to_string(),
        };
    }
    if comp.category == "GPS" {
        return match property {
            "latitude"    => "gps_get_latitude()".to_string(),
            "longitude"   => "gps_get_longitude()".to_string(),
            "altitude"    => "gps_get_altitude()".to_string(),
            "speed"       => "gps_get_speed()".to_string(),
            _             => "gps_get_hdop()".to_string(),
        };
    }

    format!("adc1_get_raw(ADC1_CHANNEL_{})", pin)
}

fn write_component_expr(comp: &WiredComponent, action: &str, value: &str) -> String {
    let name = comp.name.to_lowercase();
    let pin = comp
        .connections
        .first()
        .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
        .unwrap_or_else(|| "0".to_string());

    if name.contains("esc") || comp.category == "ESC" {
        return match action {
            "set_throttle" => format!("ledc_set_duty_and_update(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, {})", value),
            "arm"          => "ledc_set_duty_and_update(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 1000)".to_string(),
            "disarm"       => "ledc_set_duty_and_update(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, 900)".to_string(),
            _              => format!("ledc_set_duty_and_update(LEDC_LOW_SPEED_MODE, LEDC_CHANNEL_0, {})", value),
        };
    }
    if comp.category == "Display" {
        return match action {
            "print_text"   => format!("ssd1306_print(\"{}\")", value),
            "clear"        => "ssd1306_clear()".to_string(),
            _              => format!("ssd1306_print(\"{}\")", value),
        };
    }

    format!("gpio_set_level({}, {})", pin, value)
}

fn collect_globals(flow: &LogicFlow) -> Vec<String> {
    let mut globals = vec![];
    let mut declared: HashSet<String> = HashSet::new();

    for node in &flow.nodes {
        let (var_name, var_type): (Option<&str>, Option<&str>) = match &node.data {
            LogicNodeData::ReadSensor  { output_variable, .. } => (Some(output_variable), Some("float")),
            LogicNodeData::ReadPin     { output_variable, .. } => (Some(output_variable), Some("bool")),
            LogicNodeData::ReceiveUart { output_variable, .. } => (Some(output_variable), Some("char*")),
            LogicNodeData::SetVariable { variable_name, .. }   => (Some(variable_name), None),
            _ => (None, None),
        };
        if let Some(name) = var_name {
            if !name.is_empty() && declared.insert(name.to_string()) {
                let t = var_type.unwrap_or_else(|| infer_var_type(name));
                let (decl, default) = match t {
                    "char*" => {
                        globals.push(format!("static char {}[256] = {{}};", name));
                        continue;
                    }
                    "bool"  => ("bool", "false"),
                    "int"   => ("int", "0"),
                    _       => ("float", "0.0f"),
                };
                globals.push(format!("static {} {} = {};", decl, name, default));
            }
        }
    }

    // Timer state
    for node in &flow.nodes {
        if let LogicNodeData::OnTimer { .. } = &node.data {
            globals.push(format!(
                "static int64_t _timer_{}_last = 0;",
                sanitize(&node.id)
            ));
        }
    }

    globals
}

fn collect_gpio_config(flow: &LogicFlow) -> Vec<String> {
    let mut lines = vec![];
    let mut seen: HashSet<String> = HashSet::new();

    for node in &flow.nodes {
        match &node.data {
            LogicNodeData::SetPin { mcu_pin_id, mcu_pin_name, .. } => {
                let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
                if seen.insert(pin.clone()) {
                    lines.push(format!(
                        "  gpio_set_direction(GPIO_NUM_{}, GPIO_MODE_OUTPUT);",
                        pin
                    ));
                }
            }
            LogicNodeData::ReadPin { mcu_pin_id, mcu_pin_name, .. } => {
                let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
                if seen.insert(pin.clone()) {
                    lines.push(format!(
                        "  gpio_set_direction(GPIO_NUM_{}, GPIO_MODE_INPUT);",
                        pin
                    ));
                }
            }
            _ => {}
        }
    }

    lines
}

fn collect_peripheral_init(hw: &McuHardware) -> Vec<String> {
    let mut lines = vec![];
    let mut i2c_done = false;
    let mut spi_done = false;

    for comp in &hw.wired_components {
        let name = comp.name.to_lowercase();

        if comp.protocols.iter().any(|p| p == "I2C") && !i2c_done {
            i2c_done = true;
            lines.push("  /* I2C init */".to_string());
            lines.push("  i2c_config_t i2c_conf = {".to_string());
            lines.push("    .mode = I2C_MODE_MASTER,".to_string());
            lines.push("    .sda_io_num = GPIO_NUM_21,".to_string());
            lines.push("    .scl_io_num = GPIO_NUM_22,".to_string());
            lines.push("    .sda_pullup_en = GPIO_PULLUP_ENABLE,".to_string());
            lines.push("    .scl_pullup_en = GPIO_PULLUP_ENABLE,".to_string());
            lines.push("    .master.clk_speed = 400000,".to_string());
            lines.push("  };".to_string());
            lines.push("  i2c_param_config(I2C_NUM_0, &i2c_conf);".to_string());
            lines.push("  i2c_driver_install(I2C_NUM_0, i2c_conf.mode, 0, 0, 0);".to_string());
        }

        if comp.protocols.iter().any(|p| p == "SPI") && !spi_done {
            spi_done = true;
            lines.push("  /* SPI init */".to_string());
            lines.push("  spi_bus_config_t spi_conf = {".to_string());
            lines.push("    .mosi_io_num = GPIO_NUM_23,".to_string());
            lines.push("    .miso_io_num = GPIO_NUM_19,".to_string());
            lines.push("    .sclk_io_num = GPIO_NUM_18,".to_string());
            lines.push("    .quadwp_io_num = -1,".to_string());
            lines.push("    .quadhd_io_num = -1,".to_string());
            lines.push("  };".to_string());
            lines.push("  spi_bus_initialize(SPI2_HOST, &spi_conf, SPI_DMA_CH_AUTO);".to_string());
        }

        if comp.protocols.iter().any(|p| p == "UART") {
            let tx_pin = comp.connections.iter()
                .find(|c| c.mcu_pin_name.to_lowercase().contains("tx"))
                .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
                .unwrap_or_else(|| "17".to_string());
            let rx_pin = comp.connections.iter()
                .find(|c| c.mcu_pin_name.to_lowercase().contains("rx"))
                .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
                .unwrap_or_else(|| "16".to_string());
            lines.push(format!("  /* UART init for {} */", comp.name));
            lines.push("  uart_config_t uart_conf = {".to_string());
            lines.push("    .baud_rate = 115200,".to_string());
            lines.push("    .data_bits = UART_DATA_8_BITS,".to_string());
            lines.push("    .parity    = UART_PARITY_DISABLE,".to_string());
            lines.push("    .stop_bits = UART_STOP_BITS_1,".to_string());
            lines.push("    .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,".to_string());
            lines.push("  };".to_string());
            lines.push("  uart_param_config(UART_NUM_1, &uart_conf);".to_string());
            lines.push(format!("  uart_set_pin(UART_NUM_1, {}, {}, -1, -1);", tx_pin, rx_pin));
            lines.push("  uart_driver_install(UART_NUM_1, 256, 0, 0, NULL, 0);".to_string());
        }

        if name.contains("dht") {
            lines.push(format!("  /* DHT sensor on GPIO{} — init via driver */",
                comp.connections.first()
                    .map(|c| esp32_pin_num(&c.mcu_pin_id, &c.mcu_pin_name))
                    .unwrap_or_else(|| "4".to_string())
            ));
        }
    }

    lines
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

        LogicNodeData::OnTimer { interval_ms, .. } => {
            let timer_var = format!("_timer_{}_last", sanitize(&node.id));
            code.ln(&format!(
                "if ((esp_timer_get_time() - {}) >= {}LL) {{",
                timer_var, interval_ms * 1000
            ));
            code.push();
            code.ln(&format!("{} = esp_timer_get_time();", timer_var));
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
                code.ln(&format!("/* read_sensor: component {} not found */", component_node_id));
            }
        }

        LogicNodeData::ReadPin { mcu_pin_id, mcu_pin_name, output_variable, .. } => {
            let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
            code.ln(&format!("{} = gpio_get_level(GPIO_NUM_{});", output_variable, pin));
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
            code.ln(&format!("vTaskDelay(pdMS_TO_TICKS({}));", duration_ms));
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

        LogicNodeData::SetPin { mcu_pin_id, mcu_pin_name, state, .. } => {
            let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
            match state.as_str() {
                "HIGH"   => code.ln(&format!("gpio_set_level(GPIO_NUM_{}, 1);", pin)),
                "LOW"    => code.ln(&format!("gpio_set_level(GPIO_NUM_{}, 0);", pin)),
                "TOGGLE" => {
                    code.ln(&format!("gpio_set_level(GPIO_NUM_{}, !gpio_get_level(GPIO_NUM_{}));", pin, pin));
                }
                _ => code.ln(&format!("gpio_set_level(GPIO_NUM_{}, 1);", pin)),
            }
        }

        LogicNodeData::WriteComponent { component_node_id, action, raw_value, .. } => {
            if let Some(comp) = hw.wired_components.iter().find(|c| &c.circuit_node_id == component_node_id) {
                code.ln(&format!("{};", write_component_expr(comp, action, raw_value)));
            }
        }

        LogicNodeData::SendUart { data_template, .. } => {
            let msg = format!("{}\\r\\n", data_template);
            code.ln(&format!(
                "uart_write_bytes(UART_NUM_1, \"{}\", {});",
                msg, msg.len()
            ));
        }

        LogicNodeData::ReceiveUart { output_variable, .. } => {
            code.ln(&format!(
                "uart_read_bytes(UART_NUM_1, {}, sizeof({})-1, pdMS_TO_TICKS(100));",
                output_variable, output_variable
            ));
        }

        LogicNodeData::OnInterrupt { .. } => {}
    }

    if let Some(next) = graph.next(&node.id, "out") {
        gen_node(next, graph, hw, code, visited);
    }
}

pub fn generate(flow: &LogicFlow, hw: &McuHardware) -> GeneratedFile {
    let graph   = FlowGraph::new(&flow.nodes, &flow.edges);
    let globals = collect_globals(flow);
    let gpio_config = collect_gpio_config(flow);
    let peripheral_init = collect_peripheral_init(hw);

    let mut init_code  = Code::new();
    let mut task_code  = Code::new();
    let mut isr_code   = Code::new();

    for trigger in graph.triggers() {
        let mut visited = HashSet::new();
        match &trigger.data {
            LogicNodeData::OnStart { .. } => {
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut init_code, &mut visited);
                }
            }
            LogicNodeData::OnLoop { .. } | LogicNodeData::OnTimer { .. } => {
                gen_node(trigger, &graph, hw, &mut task_code, &mut visited);
            }
            LogicNodeData::OnInterrupt { mcu_pin_id, mcu_pin_name, trigger: edge, .. } => {
                let pin = esp32_pin_num(mcu_pin_id, mcu_pin_name);
                let isr_name = format!("isr_{}", sanitize(&trigger.id));

                isr_code.ln(&format!("static void IRAM_ATTR {}(void *arg) {{", isr_name));
                isr_code.push();
                if let Some(next) = graph.next(&trigger.id, "out") {
                    gen_node(next, &graph, hw, &mut isr_code, &mut visited);
                }
                isr_code.pop();
                isr_code.ln("}");
                isr_code.blank();

                let mode = match edge.as_str() {
                    "rising"  => "GPIO_INTR_POSEDGE",
                    "falling" => "GPIO_INTR_NEGEDGE",
                    _         => "GPIO_INTR_ANYEDGE",
                };
                init_code.ln(&format!("gpio_set_intr_type(GPIO_NUM_{}, {});", pin, mode));
                init_code.ln("gpio_install_isr_service(0);");
                init_code.ln(&format!(
                    "gpio_isr_handler_add(GPIO_NUM_{}, {}, NULL);",
                    pin, isr_name
                ));
            }
            _ => {}
        }
    }

    let mut out = Code::new();

    out.ln(&format!("/* {} — generated by CircuitFlow */", hw.instance_label));
    out.ln("/* ESP-IDF project — place in main/main.c */");
    out.blank();
    out.ln("#include <stdio.h>");
    out.ln("#include <string.h>");
    out.ln("#include <stdbool.h>");
    out.ln("#include \"freertos/FreeRTOS.h\"");
    out.ln("#include \"freertos/task.h\"");
    out.ln("#include \"driver/gpio.h\"");
    out.ln("#include \"driver/uart.h\"");
    out.ln("#include \"driver/i2c.h\"");
    out.ln("#include \"driver/spi_master.h\"");
    out.ln("#include \"driver/ledc.h\"");
    out.ln("#include \"esp_timer.h\"");
    out.ln("#include \"esp_log.h\"");
    out.blank();

    out.ln("static const char *TAG = \"circuitflow\";");
    out.blank();

    for g in &globals { out.ln(g); }
    out.blank();

    let isr_str = isr_code.build();
    if !isr_str.trim().is_empty() {
        for line in isr_str.lines() { out.ln(line); }
        out.blank();
    }

    // Main task
    out.ln("static void main_task(void *pvParameters) {");
    out.push();

    let init_str = init_code.build();
    if !init_str.trim().is_empty() {
        out.ln("/* Startup sequence */");
        for line in init_str.lines() { out.ln(line); }
        out.blank();
    }

    out.ln("for (;;) {");
    out.push();
    let task_str = task_code.build();
    if task_str.trim().is_empty() {
        out.ln("/* Add an On Loop or On Timer node in the Logic tab */");
        out.ln("vTaskDelay(pdMS_TO_TICKS(10));");
    } else {
        for line in task_str.lines() { out.ln(line); }
        out.ln("vTaskDelay(pdMS_TO_TICKS(1));");
    }
    out.pop();
    out.ln("}");
    out.pop();
    out.ln("}");
    out.blank();

    // app_main
    out.ln("void app_main(void) {");
    out.push();
    out.ln("ESP_LOGI(TAG, \"CircuitFlow firmware starting\");");
    out.blank();

    if !gpio_config.is_empty() {
        out.ln("/* GPIO configuration */");
        for line in &gpio_config { out.ln(line); }
        out.blank();
    }

    if !peripheral_init.is_empty() {
        out.ln("/* Peripheral initialization */");
        for line in &peripheral_init { out.ln(line); }
        out.blank();
    }

    out.ln("xTaskCreate(main_task, \"main_task\", 4096, NULL, 5, NULL);");
    out.pop();
    out.ln("}");

    GeneratedFile {
        mcu_name: hw.instance_label.clone(),
        platform: "ESP-IDF".to_string(),
        filename: "main.c".to_string(),
        content: out.build(),
    }
}