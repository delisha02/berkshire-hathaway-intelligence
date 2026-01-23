/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                // Proxy all /api/* requests to the Mastra backend
                source: '/api/:path*',
                destination: 'http://localhost:4111/api/:path*',
            },
        ];
    },
};

export default nextConfig;
