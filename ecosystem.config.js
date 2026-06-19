module.exports = {
  apps: [
    {
      name: 'wacrm-scheduler',
      script: 'src/workers/scrape-scheduler.ts',
      interpreter: 'node',
      node_args: '--import tsx',
      watch: false,
      restart_delay: 30000,
      max_restarts: 10,
      env: { NODE_ENV: 'production' },
    },
  ],
}
