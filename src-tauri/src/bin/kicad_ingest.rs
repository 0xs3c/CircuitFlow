use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::io::{Cursor, Read};
use std::time::{Duration, Instant};
use zip::ZipArchive;

// ─── Domain Types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Pin {
    id: String,
    name: String,
    #[serde(rename = "type")]
    pin_type: String,
    side: String,
    position: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Component {
    kicad_id: String,
    name: String,
    category: String,
    manufacturer: Option<String>,
    description: Option<String>,
    datasheet: Option<String>,
    tags: Vec<String>,
    pins: Vec<Pin>,
    width: i32,
    height: i32,
}

// ─── Category Mapping ─────────────────────────────────────────────────────────

fn categorise(dir_name: &str) -> &'static str {
    let d = dir_name.to_lowercase();
    if d.starts_with("mcu_") || d.starts_with("mcu.")              { return "MCU"; }
    if d.starts_with("sensor_")                                      { return "Sensors"; }
    if d.starts_with("rf_gps")                                       { return "GPS"; }
    if d.starts_with("rf_")                                          { return "Communication"; }
    if d.starts_with("regulator_") || d.starts_with("converter_")
    || d.starts_with("battery")    || d.starts_with("power_")       { return "Power"; }
    if d.starts_with("interface_")                                    { return "Interface"; }
    if d.starts_with("driver_")    || d.starts_with("motor")        { return "Driver"; }
    if d.starts_with("display")                                       { return "Display"; }
    if d.starts_with("connector")                                     { return "Connector"; }
    if d.starts_with("logic_")     || d.starts_with("74")           { return "Logic"; }
    if d.starts_with("device")                                        { return "Passive"; }
    if d.starts_with("audio")                                         { return "Audio"; }
    if d.starts_with("memory")                                        { return "Memory"; }
    if d.starts_with("pmic_")      || d.starts_with("analog_")      { return "Analog"; }
    if d.starts_with("transistor_")|| d.starts_with("diode")        { return "Discrete"; }
    "Other"
}

// ─── KiCad 10 Parser ──────────────────────────────────────────────────────────
//
// KiCad 10 format — each .kicad_sym file contains exactly one component.
// Pins are now fully multi-line:
//
//   (pin power_in line
//       (at -5.08 48.26 270)       ← angle on THIS line
//       (length 2.54)
//       (name "VBAT"               ← name on THIS line
//           (effects ...)
//       )
//       (number "1"                ← number on THIS line
//           (effects ...)
//       )
//   )
//
// Properties are also multi-line:
//   (property "Description" "STMicroelectronics Arm..."
//       (at 0 0 0)
//       ...
//   )
//
// Strategy: state machine that tracks what block we're currently inside.

#[derive(Debug, PartialEq)]
enum ParseState {
    Root,
    InProperty { key: String, value: String },
    InPin { pin_type: String, angle: f64 },
    InPinName,
    InPinNumber,
}

fn angle_to_side(angle: f64) -> &'static str {
    let a = ((angle % 360.0) + 360.0) % 360.0;
    match a as u32 {
        0..=44    => "left",
        45..=134  => "bottom",
        135..=224 => "right",
        225..=314 => "top",
        _         => "left",
    }
}

fn map_pin_type(raw: &str) -> &'static str {
    match raw {
        "input"                        => "input",
        "output"                       => "output",
        "bidirectional" | "bidi"       => "bidirectional",
        "power_in"      | "power"      => "power_in",
        "power_out"                    => "power_out",
        "passive"                      => "passive",
        "no_connect"    | "unspecified"=> "passive",
        _                              => "bidirectional",
    }
}

// Extract the first quoted string from a line.
// e.g. `(name "VBAT"` → "VBAT"
fn first_quoted(line: &str) -> Option<String> {
    let start = line.find('"')? + 1;
    let rest  = &line[start..];
    let end   = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn parse_single_component(content: &str, category: &str) -> Option<Component> {
    let mut sym_name:    Option<String>         = None;
    let mut props:       HashMap<String, String> = HashMap::new();
    let mut pins:        Vec<Pin>                = Vec::new();
    let mut side_counts: HashMap<String, i32>    = HashMap::new();

    // Current pin being assembled
    let mut cur_pin_type  = String::new();
    let mut cur_pin_angle = 0.0f64;
    let mut cur_pin_name  = String::new();
    let mut cur_pin_num   = String::new();

    let mut state = ParseState::Root;
    let mut depth: i64 = 0;

    for line in content.lines() {
        let t = line.trim();
        let opens  = t.chars().filter(|&c| c == '(').count() as i64;
        let closes = t.chars().filter(|&c| c == ')').count() as i64;

        match &state {
            ParseState::Root => {
                // Symbol name — first (symbol "...") at depth 1
                if depth == 1 && t.starts_with("(symbol \"") && sym_name.is_none() {
                    sym_name = first_quoted(t);
                }

                // Property start — (property "Key" "Value"
                // Both key and value are on the same line
                if t.starts_with("(property \"") {
                    // Split on quotes: ["(property ", "Key", " ", "Value", ...]
                    let parts: Vec<&str> = t.splitn(5, '"').collect();
                    if parts.len() >= 4 {
                        let key = parts[1].to_string();
                        let val = parts[3].to_string();
                        // Only capture top-level useful properties
                        match key.as_str() {
                            "Description" | "Datasheet" | "Manufacturer"
                            | "ki_description" | "MFN" => {
                                state = ParseState::InProperty { key, value: val };
                            }
                            _ => {}
                        }
                    }
                }

                // Pin start — (pin <type> <style>
                if t.starts_with("(pin ") && sym_name.is_some() {
                    let words: Vec<&str> = t.split_whitespace().collect();
                    cur_pin_type  = words.get(1).unwrap_or(&"passive").to_string();
                    cur_pin_angle = 0.0;
                    cur_pin_name  = String::new();
                    cur_pin_num   = String::new();
                    state = ParseState::InPin {
                        pin_type: cur_pin_type.clone(),
                        angle: 0.0,
                    };
                }
            }

            ParseState::InProperty { key, value } => {
                // We already captured the value from the opening line.
                // Just wait for the block to close (net depth returns to where we were).
                // When depth drops back we're done.
                let _ = (key, value); // suppress warning
                if closes > opens {
                    // Block closing — flush and return to root
                    // (depth update happens after this match)
                }
                // Flush when we're back at the same depth
                // We check after depth update below
            }

            ParseState::InPin { .. } => {
                // (at X Y ANGLE) line inside a pin block
                if t.starts_with("(at ") {
                    let coords: Vec<f64> = t[4..]
                        .split_whitespace()
                        .take(3)
                        .filter_map(|s| s.trim_end_matches(')').parse().ok())
                        .collect();
                    if coords.len() >= 3 {
                        cur_pin_angle = coords[2];
                    }
                }

                // (name "VBAT" — pin name line
                if t.starts_with("(name \"") {
                    cur_pin_name = first_quoted(t).unwrap_or_default();
                    state = ParseState::InPinName;
                }

                // (number "1" — pin number line
                if t.starts_with("(number \"") {
                    cur_pin_num = first_quoted(t).unwrap_or_default();
                    state = ParseState::InPinNumber;
                }
            }

            ParseState::InPinName => {
                // Wait for the name block to close then go back to InPin
                if closes > opens {
                    state = ParseState::InPin {
                        pin_type: cur_pin_type.clone(),
                        angle: cur_pin_angle,
                    };
                }
            }

            ParseState::InPinNumber => {
                // Wait for the number block to close
                if closes > opens {
                    // Pin is complete — flush it
                    let label = if cur_pin_name.is_empty() || cur_pin_name == "~" {
                        cur_pin_num.clone()
                    } else {
                        cur_pin_name.clone()
                    };

                    if !label.is_empty() {
                        let side = angle_to_side(cur_pin_angle).to_string();
                        let pos  = {
                            let c = side_counts.entry(side.clone()).or_insert(-1);
                            *c += 1;
                            *c
                        };
                        pins.push(Pin {
                            id:       format!("pin_{}", cur_pin_num),
                            name:     label,
                            pin_type: map_pin_type(&cur_pin_type).to_string(),
                            side,
                            position: pos,
                        });
                    }

                    state = ParseState::InPin {
                        pin_type: cur_pin_type.clone(),
                        angle: cur_pin_angle,
                    };
                }
            }
        }

        depth = (depth + opens - closes).max(0);

        // After depth update — flush property and return to root
        if let ParseState::InProperty { ref key, ref value } = state {
            // We return to root when the property block fully closes.
            // A property block opened at depth N, so when depth drops below N we're done.
            // Simpler: just check if this line is a pure closing line.
            if t == ")" || (closes > opens && depth <= 2) {
                props.insert(key.clone(), value.clone());
                state = ParseState::Root;
            }
        }

        // Return from InPin when the pin block closes
        if matches!(state, ParseState::InPin { .. }) && closes > opens && depth <= 2 {
            state = ParseState::Root;
        }
    }

    let name = sym_name?;
    if pins.is_empty() {
        return None;
    }

    Some(build_component(&name, category, &props, &pins))
}

fn build_component(
    name:     &str,
    category: &str,
    props:    &HashMap<String, String>,
    pins:     &[Pin],
) -> Component {
    let description  = props.get("Description")
                            .or_else(|| props.get("ki_description"))
                            .cloned();
    let datasheet    = props.get("Datasheet")
                            .filter(|s| !s.is_empty() && *s != "~")
                            .cloned();
    let manufacturer = props.get("Manufacturer")
                            .or_else(|| props.get("MFN"))
                            .cloned();

    let searchable = format!(
        "{} {}",
        name,
        description.as_deref().unwrap_or("")
    ).to_lowercase();

    let keywords = [
        "drone","uav","imu","gps","gnss","uart","spi","i2c","can","pwm",
        "adc","dac","wifi","bluetooth","ble","lora","zigbee","arm","cortex",
        "stm32","esp32","arduino","nrf","sensor","motor","esc","battery",
        "regulator","buck","boost","mosfet","gate","driver",
    ];

    let mut tags: Vec<String> = vec![category.to_lowercase()];
    for kw in &keywords {
        if searchable.contains(kw) {
            tags.push(kw.to_string());
        }
    }
    tags.dedup();

    let left_count  = pins.iter().filter(|p| p.side == "left").count();
    let right_count = pins.iter().filter(|p| p.side == "right").count();
    let max_side    = left_count.max(right_count).max(1);
    let height      = ((max_side * 24) + 60).max(80) as i32;

    Component {
        kicad_id:     name.to_string(),
        name:         name.to_string(),
        category:     category.to_string(),
        manufacturer,
        description,
        datasheet,
        tags,
        pins:         pins.to_vec(),
        width:        220,
        height,
    }
}

// ─── Supabase Upload ──────────────────────────────────────────────────────────

fn upload_all(
    client:      &Client,
    components:  &[Component],
    base_url:    &str,
    service_key: &str,
) -> Result<usize> {
    const BATCH: usize = 100;
    let total_batches = (components.len() + BATCH - 1) / BATCH;
    let mut uploaded = 0;

    for (i, chunk) in components.chunks(BATCH).enumerate() {
        print!(
            "\r  Uploading batch {:>4}/{} — {:>6} components done ...",
            i + 1, total_batches, uploaded
        );
        std::io::Write::flush(&mut std::io::stdout()).ok();

        let payload: Vec<Value> = chunk.iter().map(|c| json!({
            "kicad_id":     c.kicad_id,
            "name":         c.name,
            "category":     c.category,
            "manufacturer": c.manufacturer,
            "description":  c.description,
            "datasheet":    c.datasheet,
            "tags":         c.tags,
            "pins":         serde_json::to_value(&c.pins).unwrap_or(json!([])),
            "width":        c.width,
            "height":       c.height,
            "source":       "kicad",
        })).collect();

        let resp = client
            .post(format!("{}/rest/v1/components", base_url))
            .header("apikey",        service_key)
            .header("Authorization", format!("Bearer {}", service_key))
            .header("Content-Type",  "application/json")
            .header("Prefer",        "resolution=merge-duplicates,return=minimal")
            .json(&payload)
            .send()
            .context("HTTP request to Supabase failed")?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body   = resp.text().unwrap_or_default();
            eprintln!(
                "\n  Batch {} error {}: {}",
                i + 1, status,
                &body[..body.len().min(300)]
            );
        } else {
            uploaded += chunk.len();
        }

        std::thread::sleep(Duration::from_millis(50));
    }

    println!();
    Ok(uploaded)
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

fn main() -> Result<()> {
    let started = Instant::now();

    let supabase_url = std::env::var("SUPABASE_URL")
        .context("SUPABASE_URL is not set")?;
    let service_key  = std::env::var("SUPABASE_SERVICE_KEY")
        .context("SUPABASE_SERVICE_KEY is not set — use the service_role key")?;

    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .user_agent("CircuitFlow/1.0 KiCad-Ingest")
        .build()
        .context("Failed to build HTTP client")?;

    println!("╔══════════════════════════════════════════════╗");
    println!("║     CircuitFlow — KiCad Library Ingestion    ║");
    println!("╚══════════════════════════════════════════════╝");
    println!();
    println!("  Target : {}", supabase_url);
    println!("  Format : KiCad 10 — one component per .kicad_sym file");
    println!();

    // ── Phase 1: Download ZIP ─────────────────────────────────────────────────

    const ZIP_URL: &str =
        "https://gitlab.com/kicad/libraries/kicad-symbols/-/archive/master/kicad-symbols-master.zip";

    println!("Phase 1 — Downloading KiCad symbol library archive");
    println!("────────────────────────────────────────────────────");
    print!("  Downloading ...");
    std::io::Write::flush(&mut std::io::stdout()).ok();

    let zip_bytes = client
        .get(ZIP_URL)
        .send()
        .context("Failed to download KiCad ZIP")?
        .bytes()
        .context("Failed to read ZIP bytes")?;

    println!(" {:.1} MB received", zip_bytes.len() as f64 / 1_048_576.0);

    // ── Phase 2: Extract & Parse ──────────────────────────────────────────────

    println!();
    println!("Phase 2 — Extracting and parsing component files");
    println!("────────────────────────────────────────────────────");

    let cursor  = Cursor::new(zip_bytes);
    let mut zip = ZipArchive::new(cursor).context("Failed to open ZIP archive")?;

    let mut all_components: Vec<Component> = Vec::new();
    let mut files_parsed  = 0usize;
    let mut files_no_pins = 0usize;
    let mut files_skipped = 0usize;
    let mut last_lib      = String::new();

    for i in 0..zip.len() {
        let mut file = zip.by_index(i)?;
        let raw_path = file.name().to_string();

        // Only process .kicad_sym files inside a .kicad_symdir directory
        if !raw_path.ends_with(".kicad_sym") {
            continue;
        }

        let parts: Vec<&str> = raw_path.split('/').collect();
        if parts.len() < 3 {
            files_skipped += 1;
            continue;
        }

        let dir_name  = parts[parts.len() - 2];
        if !dir_name.ends_with(".kicad_symdir") {
            files_skipped += 1;
            continue;
        }

        let lib_name = dir_name.trim_end_matches(".kicad_symdir");
        let category = categorise(lib_name);

        if category == "Other" {
            files_skipped += 1;
            continue;
        }

        // Print a header line each time we enter a new library
        if lib_name != last_lib {
            println!("  [{:>14}]  {}", category, lib_name);
            last_lib = lib_name.to_string();
        }

        let mut content = String::new();
        if file.read_to_string(&mut content).is_err() {
            files_skipped += 1;
            continue;
        }

        match parse_single_component(&content, category) {
            Some(comp) => {
                println!("               + {} ({} pins)", comp.name, comp.pins.len());
                all_components.push(comp);
                files_parsed += 1;
            }
            None => {
                files_no_pins += 1;
            }
        }
    }

    println!();
    println!("  Files with components : {}", files_parsed);
    println!("  Files without pins    : {}", files_no_pins);
    println!("  Files skipped         : {}", files_skipped);
    println!("  Total raw             : {} components", all_components.len());

    // ── Phase 3: Deduplicate ──────────────────────────────────────────────────

    let pre_dedup = all_components.len();
    let mut seen: HashSet<String> = HashSet::new();
    all_components.retain(|c| seen.insert(c.kicad_id.clone()));
    println!("  Duplicates removed    : {}", pre_dedup - all_components.len());
    println!("  Final unique          : {} components", all_components.len());

    if all_components.is_empty() {
        anyhow::bail!("No components parsed — check parser output above.");
    }

    // ── Phase 4: Upload ───────────────────────────────────────────────────────

    println!();
    println!("Phase 3 — Uploading to Supabase");
    println!("────────────────────────────────────────────────────");

    let uploaded = upload_all(&client, &all_components, &supabase_url, &service_key)?;

    // ── Summary ───────────────────────────────────────────────────────────────

    println!();
    println!("╔══════════════════════════════════════════════╗");
    println!("║                   Summary                    ║");
    println!("╠══════════════════════════════════════════════╣");
    println!("║  Parsed    {:>6} components                 ║", files_parsed);
    println!("║  Uploaded  {:>6} components                 ║", uploaded);
    println!("║  Duration  {:.1}s                            ║", started.elapsed().as_secs_f64());
    println!("╚══════════════════════════════════════════════╝");
    println!();
    println!("  Done. Component library is live in Supabase.");
    println!("  Re-run after KiCad releases to sync updates.");

    Ok(())
}