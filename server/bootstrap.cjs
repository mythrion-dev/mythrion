// Wrapper to load ESM module from CommonJS context
(async () => {
  try {
    const { bootstrap } = await import('./dist/main.js');
    await bootstrap();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
})();
