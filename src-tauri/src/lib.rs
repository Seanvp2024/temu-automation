mod commands;
mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            // 初始化数据库
            let db_path = app_data_dir.join("temu_automation.db");
            db::init_database(&db_path).expect("failed to init database");

            // 保存数据库路径到状态中
            app.manage(db::DbState {
                path: db_path.to_string_lossy().to_string(),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::account::get_accounts,
            commands::account::add_account,
            commands::account::delete_account,
            commands::config::get_config,
            commands::config::save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
