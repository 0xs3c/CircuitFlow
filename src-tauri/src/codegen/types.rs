use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Clone)]
pub struct FlowNode {
    pub id: String,
    pub data: LogicNodeData,
}

#[derive(Deserialize, Debug, Clone)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "sourceHandle", default)]
    pub source_handle: Option<String>,
    #[serde(rename = "targetHandle", default)]
    pub target_handle: Option<String>,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "nodeType")]
pub enum LogicNodeData {
    #[serde(rename = "on_start")]
    OnStart {
        #[serde(default)]
        label: Option<String>,
    },
    #[serde(rename = "on_loop")]
    OnLoop {
        #[serde(default)]
        label: Option<String>,
    },
    #[serde(rename = "on_timer")]
    OnTimer {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "intervalMs")]
        interval_ms: u64,
    },
    #[serde(rename = "on_interrupt")]
    OnInterrupt {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "mcuPinId")]
        mcu_pin_id: String,
        #[serde(rename = "mcuPinName")]
        mcu_pin_name: String,
        trigger: String,
    },
    #[serde(rename = "read_sensor")]
    ReadSensor {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "componentNodeId")]
        component_node_id: String,
        #[serde(rename = "componentName")]
        component_name: String,
        #[serde(rename = "readProperty")]
        read_property: String,
        #[serde(rename = "outputVariable")]
        output_variable: String,
    },
    #[serde(rename = "read_pin")]
    ReadPin {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "mcuPinId")]
        mcu_pin_id: String,
        #[serde(rename = "mcuPinName")]
        mcu_pin_name: String,
        #[serde(rename = "outputVariable")]
        output_variable: String,
    },
    #[serde(rename = "condition")]
    Condition {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "variableName")]
        variable_name: String,
        operator: String,
        #[serde(rename = "compareValue")]
        compare_value: String,
    },
    #[serde(rename = "wait")]
    Wait {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "durationMs")]
        duration_ms: u64,
    },
    #[serde(rename = "loop_count")]
    LoopCount {
        #[serde(default)]
        label: Option<String>,
        count: u64,
    },
    #[serde(rename = "loop_while")]
    LoopWhile {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "variableName")]
        variable_name: String,
        operator: String,
        #[serde(rename = "compareValue")]
        compare_value: String,
    },
    #[serde(rename = "set_variable")]
    SetVariable {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "variableName")]
        variable_name: String,
        #[serde(rename = "valueSource")]
        value_source: String,
        #[serde(rename = "rawValue")]
        raw_value: String,
    },
    #[serde(rename = "set_pin")]
    SetPin {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "mcuPinId")]
        mcu_pin_id: String,
        #[serde(rename = "mcuPinName")]
        mcu_pin_name: String,
        state: String,
    },
    #[serde(rename = "write_component")]
    WriteComponent {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "componentNodeId")]
        component_node_id: String,
        #[serde(rename = "componentName")]
        component_name: String,
        action: String,
        #[serde(rename = "valueSource")]
        value_source: String,
        #[serde(rename = "rawValue")]
        raw_value: String,
    },
    #[serde(rename = "send_uart")]
    SendUart {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "txPinId")]
        tx_pin_id: String,
        #[serde(rename = "txPinName")]
        tx_pin_name: String,
        #[serde(rename = "targetMcuNodeId")]
        target_mcu_node_id: Option<String>,
        #[serde(rename = "dataTemplate")]
        data_template: String,
    },
    #[serde(rename = "receive_uart")]
    ReceiveUart {
        #[serde(default)]
        label: Option<String>,
        #[serde(rename = "rxPinId")]
        rx_pin_id: String,
        #[serde(rename = "rxPinName")]
        rx_pin_name: String,
        #[serde(rename = "outputVariable")]
        output_variable: String,
    },
}

#[derive(Deserialize, Debug, Clone)]
pub struct LogicFlow {
    #[serde(rename = "mcuNodeId")]
    pub mcu_node_id: String,
    #[serde(rename = "mcuName")]
    pub mcu_name: String,
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct PinConnection {
    #[serde(rename = "mcuPinId")]
    pub mcu_pin_id: String,
    #[serde(rename = "mcuPinName")]
    pub mcu_pin_name: String,
    #[serde(rename = "componentPinId")]
    pub component_pin_id: String,
    #[serde(rename = "componentPinName")]
    pub component_pin_name: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct WiredComponent {
    #[serde(rename = "circuitNodeId")]
    pub circuit_node_id: String,
    #[serde(rename = "definitionId")]
    pub definition_id: String,
    pub name: String,
    pub category: String,
    #[serde(rename = "instanceLabel")]
    pub instance_label: String,
    pub connections: Vec<PinConnection>,
    pub protocols: Vec<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct McuHardware {
    #[serde(rename = "circuitNodeId")]
    pub circuit_node_id: String,
    pub name: String,
    #[serde(rename = "instanceLabel")]
    pub instance_label: String,
    #[serde(rename = "wiredComponents")]
    pub wired_components: Vec<WiredComponent>,
    #[serde(rename = "connectedMcuIds")]
    pub connected_mcu_ids: Vec<String>,
}

#[derive(Deserialize, Debug, Clone)]
pub struct HardwareMap {
    pub mcus: Vec<McuHardware>,
}

#[derive(Deserialize, Debug)]
pub struct GenerateCodeRequest {
    pub flows: Vec<LogicFlow>,
    #[serde(rename = "hardwareMap")]
    pub hardware_map: HardwareMap,
}

#[derive(Serialize, Debug)]
pub struct GeneratedFile {
    #[serde(rename = "mcuName")]
    pub mcu_name: String,
    pub platform: String,
    pub filename: String,
    pub content: String,
}

#[derive(Serialize, Debug)]
pub struct GenerateCodeResponse {
    pub files: Vec<GeneratedFile>,
}