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

Each ```kai``` command (```kai create```, ```kai apply```, etc.) operates in the ```migrations/``` folder of the current working directory.

A ```migrations``` table is created in the PostgreSQL database to track applied, rolled back, or failed migrations.

All migrations are executed directly via ```.sql``` files — no transpilation or code compilation is involved.

The database configuration is defined in a ```config.json``` file with named environments (e.g., ```dev```, ```prod```).

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

### 1. Create working folder and ```config.json``` file

```
{
  "environments": {
    "dev": {
      "host": "localhost",
      "port": 5432,
      "user": "your_db_user",
      "password": "your_password",
      "database": "your_database_name"
    }
  }
}
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
kai apply <env>
```

Applies all pending migrations for the specified environment (e.g., ```kai apply dev```). If any of them fail, none will be applied (all-or-nothing).

### ↩️ Rollback migrations

```
kai rollback <env>
```

OR

```
kai rollback <env> <migration_id>
```

### 📋 Show migration status

```
kai status <env>
```

Displays the status of the latest 5 batches:

[✓] Applied

[↩] Rolled back

[!] Failed

[ ] Pending

## 🌐 Environment Variables (.env)

| Field    | Description                |
| -------- | -------------------------- |
| host     | PostgreSQL server hostname |
| port     | PostgreSQL server port     |
| user     | Database username          |
| password | Database password          |
| database | Target database name       |

The ```config.json``` file must exist in the directory where you run the kai command.

## 🧹 Unlink global CLI (optional)

```
npm unlink -g
```

## 📄 License

MIT – Developed by Leonardo Gian Pottmayer
