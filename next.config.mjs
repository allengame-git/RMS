/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    serverExternalPackages: ['@pdf-lib/fontkit', 'pdf-lib'],
    experimental: {
        serverActions: {
            bodySizeLimit: '100mb'
        }
    }
};

export default nextConfig;
