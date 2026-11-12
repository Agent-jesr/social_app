export const connectionOptions = {
    host: process.env.REDIS_HOST || 'pilot_express_project-redis-1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
};