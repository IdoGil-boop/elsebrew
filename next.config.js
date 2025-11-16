/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['maps.googleapis.com', 'lh3.googleusercontent.com'],
  },
}

module.exports = nextConfig
