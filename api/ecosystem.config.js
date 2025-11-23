module.exports = {
  apps: [{
    name: 'pingpong-api',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/app/logs/err.log',
    out_file: '/app/logs/out.log',
    log_file: '/app/logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
