/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    serverExternalPackages: ['puppeteer', 'puppeteer-core', '@pdf-lib/fontkit', 'pdf-lib'],
    experimental: {
        serverActions: {
            bodySizeLimit: '100mb'
        }
    }
};

export default nextConfig;
