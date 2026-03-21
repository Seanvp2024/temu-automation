use rusqlite::Connection;
use std::path::Path;

pub struct DbState {
    pub path: String,
}

pub fn init_database(path: &Path) -> Result<(), rusqlite::Error> {
    let conn = Connection::open(path)?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            password_encrypted TEXT NOT NULL,
            status TEXT DEFAULT 'offline',
            last_login_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            temu_product_id TEXT,
            title TEXT NOT NULL,
            sku TEXT,
            price REAL,
            stock INTEGER DEFAULT 0,
            status TEXT DEFAULT 'unknown',
            category TEXT,
            image_url TEXT,
            synced_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL,
            temu_order_id TEXT,
            product_title TEXT,
            quantity INTEGER DEFAULT 1,
            amount REAL,
            status TEXT DEFAULT 'pending',
            order_time TEXT,
            synced_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (account_id) REFERENCES accounts(id)
        );

        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER,
            task_type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            message TEXT,
            screenshot_path TEXT,
            started_at TEXT,
            finished_at TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS app_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        ",
    )?;

    Ok(())
}

pub fn get_connection(state: &DbState) -> Result<Connection, rusqlite::Error> {
    Connection::open(&state.path)
}
