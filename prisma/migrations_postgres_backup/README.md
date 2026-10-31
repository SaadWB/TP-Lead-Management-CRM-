# PostgreSQL Migrations Backup

This directory serves as the backup archive for legacy PostgreSQL migrations prior to switching the CRM database engine to MySQL (MariaDB/phpMyAdmin).

- Switched to MySQL provider on: 2026-10-30
- Initial PostgreSQL migration state: Schema was defined in `prisma/schema.prisma` with `provider = "postgresql"`.
- All future migrations will target the MySQL database `tp-lead-management-crm`.

