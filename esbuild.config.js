/**
 * esbuild configuration file
 * This file contains configuration options for the esbuild bundler
 */

module.exports = {
  // Core build options
  entryPoints: ['server.js'],
  bundle: true,
  platform: 'node',
  target: 'node16',
  outdir: 'dist',
  
  // Performance and debugging options
  sourcemap: false, // Set to true for development builds
  minify: true, // Set to true for production builds
  
  // Module resolution options
  resolveExtensions: ['.js', '.json'],
  
  // Assets and resources
  loader: {
    '.js': 'js',
    '.json': 'json',
  },
  
  // Advanced options
  metafile: true, // Generate metadata about the build
  
  // Define environment variables
  define: {
    'process.env.NODE_ENV': '"production"'
  }
};
