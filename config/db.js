import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://app_user:app_password@pilot_express_project-new-postgres-db-1:5432/image_scheduler_db'
});

export async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS scheduled_images (
            id SERIAL PRIMARY KEY,
            image_url TEXT NOT NULL,
            title VARCHAR(255) NOT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            publish_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    `);
    console.log('PostgreSQL table verified.');
}