// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Tries to open the given URL in VLC. Tries common install paths on Windows.
#[tauri::command]
fn open_in_vlc(url: String) -> Result<(), String> {
    let vlc_path = if cfg!(target_os = "windows") {
        // Try PATH first, then common install locations
        let path_vlc = which::which("vlc").ok();
        let path_vlc_exe = which::which("vlc.exe").ok();
        path_vlc
            .or(path_vlc_exe)
            .map(|p| p.to_string_lossy().into_owned())
            .or_else(|| {
                let pf = std::env::var("ProgramFiles").ok()?;
                let path = PathBuf::from(pf).join("VideoLAN").join("VLC").join("vlc.exe");
                path.exists().then(|| path.to_string_lossy().into_owned())
            })
            .or_else(|| {
                let pf = std::env::var("ProgramFiles(x86)").ok()?;
                let path = PathBuf::from(pf).join("VideoLAN").join("VLC").join("vlc.exe");
                path.exists().then(|| path.to_string_lossy().into_owned())
            })
    } else if cfg!(target_os = "macos") {
        which::which("vlc").ok().map(|p| p.to_string_lossy().into_owned()).or_else(|| {
            let p = PathBuf::from("/Applications/VLC.app/Contents/MacOS/VLC");
            p.exists().then(|| p.to_string_lossy().into_owned())
        })
    } else {
        which::which("vlc").ok().map(|p| p.to_string_lossy().into_owned())
    };

    let vlc_path = vlc_path.ok_or_else(|| {
        "VLC not found. Install VLC and ensure it is in your PATH or in Program Files (Windows).".to_string()
    })?;

    Command::new(&vlc_path)
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Failed to start VLC: {}", e))?;
    Ok(())
}

/// Opens a new Tauri window with the video player. Async to avoid Windows deadlock.
#[tauri::command]
async fn open_video_window(
    app: tauri::AppHandle,
    title: String,
    stream_url: String,
) -> Result<(), String> {
    let label = format!(
        "video-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let encoded = urlencoding::encode(&stream_url);
    // Path relative to app URL (dev server or tauri://localhost in prod)
    let path = format!("video-window?url={}", encoded);
    let url = tauri::WebviewUrl::App(PathBuf::from(path));
    tauri::WebviewWindowBuilder::new(&app, &label, url)
        .title(title)
        .inner_size(960.0, 640.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_video_window, open_in_vlc])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
