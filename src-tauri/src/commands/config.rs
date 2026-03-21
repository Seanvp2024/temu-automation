use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::State;

use crate::db::{self, DbState};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub key: String,
    pub value: String,
}

#[tauri::command]
pub fn get_config(db_state: State<DbState>) -> Result<HashMap<String, String>, String> {
    let conn = db::get_connection(&db_state).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT key, value FROM app_config")
        .map_err(|e| e.to_string())?;

    let configs: HashMap<String, String> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(configs)
}

#[tauri::command]
pub fn save_config(db_state: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = db::get_connection(&db_state).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
