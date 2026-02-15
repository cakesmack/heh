/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        unoptimized: true, // Keep for static export compatibility, but allow remotePatterns for future SSR
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'dynamic-media-cdn.tripadvisor.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'pixabay.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'www.kingsmillshotel.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'www.visitscotland.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'www.ullapool.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'imagedelivery.net',
                port: '',
                pathname: '/**',
            },
        ],
    },
    trailingSlash: true,
}

module.exports = nextConfig
