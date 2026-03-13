/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    serverExternalPackages: ['@pdf-lib/fontkit', 'pdf-lib', 'unzipper'],
    images: {
        unoptimized: true,
    },
    allowedDevOrigins: ['http://200.200.24.105'],
    experimental: {
        serverActions: {
            bodySizeLimit: '100mb'
        }
    }
};

export default nextConfig;
