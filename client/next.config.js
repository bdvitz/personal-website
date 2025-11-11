/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow cross-origin requests from localhost variations during development
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    'localhost:3001',
    '127.0.0.1:3001',
  ],
}

module.exports = nextConfig
