import('./dist/main.js')
  .then(({ bootstrap }) => {
    if (bootstrap) {
      return bootstrap();
    } else {
      throw new Error('bootstrap function not found in main.js');
    }
  })
  .catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
