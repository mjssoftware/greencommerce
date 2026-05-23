module.exports = {
  apps: [{
    name: 'payment-service',
    script: 'src/app.js',
    instances: 2,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3004
    },
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true,
    kill_timeout: 5000,
    listen_timeout: 10000
  }]
};