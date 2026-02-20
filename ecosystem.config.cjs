/**
 * PM2 ecosystem file - Molino
 * Uso: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "molino",
      script: "backend/index.js",
      cwd: "./",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/pm2-err.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
