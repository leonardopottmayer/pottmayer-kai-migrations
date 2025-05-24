# 🧬 Kai - SQL Migrations CLI

**Kai** is a TypeScript-based CLI tool for managing PostgreSQL database migrations using plain `.sql` files. Each migration is stored in a timestamped folder containing `up.sql` and `down.sql` scripts.

---

## 📁 Migration Structure

```bash
migrations/
├── 20250523010101-create-users-table/
│   ├── 20250523010101-create-users-table.up.sql
│   └── 20250523010101-create-users-table.down.sql
```

## ⚙️ How It Works

Each kai command (kai create, kai apply, etc.) operates in the migrations/ folder of the current working directory.

A migrations table is created in the PostgreSQL database to track applied, rolled back, or failed migrations.

All migrations are executed directly via SQL — no transpilation or code compilation is involved.

## 🚀 Installation

### 1. Clone the CLI project

```
git clone https://github.com/leonardopottmayer/pottmayer-kai-migrations
cd kai
npm install
```

### 2. Build the CLI

```
npm run build
```

### 3. Link globally to use the ```kai``` command

```
npm link
```

## 🧪 Using Kai in a migrations project

### 1. Create working folder and ```.env``` file

```
mkdir my-migrations-project
cd my-migrations-project
echo PG_HOST=localhost >> .env
echo PG_PORT=5432 >> .env
echo PG_USER=your_db_user >> .env
echo PG_PASSWORD=your_password >> .env
echo PG_DATABASE=your_database_name >> .env
```

### 2. Create the migrations directory

```
mkdir migrations
```

## 📦 Available Commands

### 📁 Create a new migration

```
kai create create-users-table
```

Creates a new folder with ```up.sql``` and ```down.sql``` files prefixed with a timestamp.

### ✅ Apply pending migrations

```
kai apply
```

Applies all pending migrations. If any of them fail, none will be applied (all-or-nothing).

### ↩️ Rollback migrations

```
kai rollback
```

OR

```
kai rollback <migration_id>
```

### 📋 Show migration status

```
kai status
```

Displays the status of the latest 5 batches:

[✓] Applied

[↩] Rolled back

[!] Failed

[ ] Pending

## 🌐 Environment Variables (.env)

| Variable     | Description                |
| ------------ | -------------------------- |
| PG\_HOST     | PostgreSQL server hostname |
| PG\_PORT     | PostgreSQL server port     |
| PG\_USER     | Database username          |
| PG\_PASSWORD | Database password          |
| PG\_DATABASE | Target database name       |

The ```.env``` file must exist in the directory where you run the kai command.

## 🧹 Unlink global CLI (optional)

```
npm unlink -g
```

## 📄 License

MIT – Developed by Leonardo Gian Pottmayer
