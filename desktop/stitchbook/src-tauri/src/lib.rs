// StitchBook desktop shell. The window itself just loads the real, live StitchBook page (see
// tauri.conf.json's app.windows[0].url) -- there is deliberately no app logic here. This file
// exists only because Tauri's mobile/desktop entry convention expects a `run()` in the library
// crate that `main.rs` calls into.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running StitchBook");
}
