const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/_offline',
  },
  runtimeCaching: [
    // Pre-cache critical POS pages with StaleWhileRevalidate for offline support
    {
      urlPattern: /\/dashboard\/market\/pos\/\d+\/payment/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pos-payment-page',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /\/dashboard\/market\/pos\/\d+\/receipt/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pos-receipt-page',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /\/dashboard\/market\/pos\/\d+$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pos-main-page',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // Next.js static files - CacheFirst for best offline performance
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        },
      },
    },
    // Next.js chunks and bundles
    {
      urlPattern: /\/_next\/.*\.js$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-js-bundles',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // Images
    {
      urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
        },
      },
    },
    // Static resources
    {
      urlPattern: /^https?:\/\/.*\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
    // POS API - NetworkFirst with fallback
    {
      urlPattern: /\/api\/market\/pos\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pos-api',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
        networkTimeoutSeconds: 5,
      },
    },
    // Other POS pages
    {
      urlPattern: /\/dashboard\/market\/pos\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pos-pages',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
        },
      },
    },
    // Next.js data fetching
    {
      urlPattern: /\/_next\/data\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'next-data',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
        networkTimeoutSeconds: 5,
      },
    },
    // Agency rates API - cache for offline use
    {
      urlPattern: /\/api\/agency-rates/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'agency-rates',
        expiration: {
          maxEntries: 5,
          maxAgeSeconds: 60 * 60 * 24, // 1 day
        },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
}

module.exports = withPWA(nextConfig)
