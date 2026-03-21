use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{self, DbState};

#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub status: String,
    pub last_login_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AddAccountRequest {
    pub name: String,
    pub email: String,
    pub password: String,
}

#[tauri::command]
pub fn get_accounts(db_state: State<DbState>) -> Result<Vec<Account>, String> {
    let conn = db::get_connection(&db_state).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, email, status, last_login_at, created_at FROM accounts ORDER BY id DESC")
        .map_err(|e| e.to_string())?;

    let accounts = stmt
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                status: row.get(3)?,
                last_login_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(accounts)
}

#[tauri::command]
pub fn add_account(db_state: State<DbState>, request: AddAccountRequest) -> Result<Account, String> {
    let conn = db::get_connection(&db_state).map_err(|e| e.to_string())?;

    // TODO: 实际使用时应加密密码
    let password_encrypted = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        request.password.as_bytes(),
    );

    conn.execute(
        "INSERT INTO accounts (name, email, password_encrypted) VALUES (?1, ?2, ?3)",
        rusqlite::params![request.name, request.email, password_encrypted],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    Ok(Account {
        id,
        name: request.name,
        email: request.email,
        status: "offline".to_string(),
        last_login_at: None,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub fn delete_account(db_state: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db::get_connection(&db_state).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM accounts WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
